import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { hashSync, genSaltSync } from "bcrypt";

import { Role, User } from "@prisma/client";
import { PrismaService } from "@prisma/prisma.service";
import { JwtPayload } from "@auth/interfaces";
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";

import { EditUserDto, FindAllQueryDto } from "./dto";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: Partial<User>) {
    const hashedPassword = this.hashPassword(dto.password);
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    const user = await this.prismaService.user
      .create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          password: hashedPassword,
          verified: isDevelopment,
          banned: dto.banned,
          roles: [Role.USER],
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          verified: true,
          roles: true,
          createdAt: true,
        },
      })
      .catch(() => {
        this.logger.error(`Failed to create user. User already exists with email: ${user.email}`);
        throw new ConflictException("Пользователь с таким email уже зарегистрирован");
      });

    this.logger.log(`Created user: ${user.id}`);

    return user;
  }

  async findAll(dto: FindAllQueryDto) {
    this.logger.log(`Finding users with query: ${JSON.stringify(dto)}`);
    const users = await this.prismaService.user.findMany({
      where: {
        roles: {
          hasSome: dto.roles,
        },
      },
      orderBy: {
        createdAt: dto.createdAt,
      },
      skip: dto.page * dto.pageSize - dto.pageSize,
      take: dto.pageSize,
    });

    const count = await this.prismaService.user
      .aggregate({
        _count: true,
        where: {
          roles: {
            hasSome: dto.roles,
          },
        },
      })
      .then((res) => res._count)
      .catch(() => 0);

    const pageCount = Math.ceil(count / dto.pageSize);

    this.logger.log(`Found ${users.length} users with query: ${JSON.stringify(dto)}`);

    return { users, count, page: dto.page, pageSize: dto.pageSize, pageCount };
  }

  async findOne(idOrEmail: string) {
    const user = await this.prismaService.user.findFirst({
      where: {
        OR: [{ id: idOrEmail }, { email: idOrEmail }],
      },
    });

    return user;
  }

  async delete(id: string, user: JwtPayload) {
    this.logger.log(`Deleting user: ${id}`);
    if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
      this.logger.error(`User ${user.id} is not allowed to delete user: ${id}`);
      throw new ForbiddenException();
    }

    await Promise.all([
      this.prismaService.user.delete({ where: { id }, select: { id: true } }).catch(() => {
        throw new NotFoundException();
      }),

      this.cacheManager.del(id),
      this.cacheManager.del(user.email),
    ]);

    this.logger.log(`Deleted user: ${id}`);

    return;
  }

  async edit(id: string, dto: EditUserDto) {
    this.logger.log(`Editing user: ${id}`);

    const _user = this.prismaService.user.findUnique({
      where: {
        id,
      },
    });

    if (!_user) {
      this.logger.error(`User not found. Failed to edit user: ${id}`);
      throw new NotFoundException("Пользователь не найден");
    }

    const user = this.prismaService.user
      .update({
        where: {
          id,
        },
        data: {
          ...dto,
        },
        select: {
          email: true,
          fullName: true,
          verified: true,
          banned: true,
          roles: true,
          createdAt: true,
        },
      })
      .catch(() => {
        this.logger.error(`Failed to edit user. Invalid data: ${id}`);
        throw new BadRequestException("Неверные данные");
      });

    this.logger.debug(`Edited user: ${id}`);

    return user;
  }

  async getMe(id: string) {
    this.logger.log(`Getting user by access token: ${id}`);
    return await this.prismaService.user.findFirst({
      where: { id },
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        roles: true,
      },
    });
  }

  private hashPassword(password: string) {
    return hashSync(password, genSaltSync(10));
  }
}
