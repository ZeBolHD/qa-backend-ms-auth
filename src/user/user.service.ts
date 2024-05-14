import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hashSync, genSaltSync } from "bcrypt";

import { Role, User } from "@prisma/client";
import { PrismaService } from "@prisma/prisma.service";
import { JwtPayload } from "@auth/interfaces";
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";

import { EditUserDto, FindAllQueryDto } from "./dto";
import { PinoLogger } from "nestjs-pino";

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserService.name);
  }

  async create(dto: Partial<User>): Promise<Omit<User, "password" | "updatedAt">> {
    const hashedPassword = this.hashPassword(dto.password);
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    this.logger.info(
      {
        user: {
          email: dto.email,
          fullName: dto.fullName,
          verified: isDevelopment,
          banned: dto.banned,
        },
      },
      "Create user",
    );

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
          banned: true,
          roles: true,
          createdAt: true,
        },
      })
      .catch((e) => {
        this.logger.debug(e, "Failed to create user");

        this.logger.error(
          {
            user: {
              email: dto.email,
              fullName: dto.fullName,
              verified: isDevelopment,
              banned: dto.banned,
            },
          },
          "Failed to create user. User already exists with the same email.",
        );
        throw new ConflictException("Пользователь с таким email уже зарегистрирован");
      });

    this.logger.info(
      {
        user,
      },
      "Created user",
    );

    return user;
  }

  async findAll(dto: FindAllQueryDto) {
    this.logger.info({ query: dto }, "Find all users");
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

    this.logger.info({ query: dto, count, pageCount }, "Find all users");

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
    this.logger.info({ user: { id } }, "Delete user");
    if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
      this.logger.error(
        { user: { id } },
        "Failed to delete user. User is not allowed to delete other users",
      );
      throw new ForbiddenException();
    }

    await Promise.all([
      this.prismaService.user.delete({ where: { id }, select: { id: true } }).catch(() => {
        this.logger.error({ user: { id } }, "Failed to delete user. User not found");
        throw new NotFoundException();
      }),

      this.cacheManager.del(id),
      this.cacheManager.del(user.email),
    ]);

    this.logger.info({ user: { id } }, "Deleted user");

    return;
  }

  async edit(id: string, dto: EditUserDto) {
    this.logger.info({ user: { id, ...dto } }, "Edit user");

    const _user = this.prismaService.user.findUnique({
      where: {
        id,
      },
    });

    if (!_user) {
      this.logger.error({ user: { id } }, "Failed to edit user. User not found");
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
      .catch((e) => {
        this.logger.debug(e, "Failed to edit user");
        this.logger.error({ user: { id, ...dto } }, "Failed to edit user. Invalid data");
        throw new BadRequestException("Неверные данные");
      });

    this.logger.debug(`Edited user: ${id}`);

    return user;
  }

  async getMe(id: string) {
    this.logger.info({ user: { id } }, "Get user by access token");
    return await this.prismaService.user
      .findFirst({
        where: { id },
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          roles: true,
        },
      })
      .catch((e) => {
        this.logger.debug(e, "Failed to get user by access token");
        this.logger.error({ user: { id } }, "Failed to get user by access token. User not found");
        throw new NotFoundException();
      });
  }

  private hashPassword(password: string) {
    return hashSync(password, genSaltSync(10));
  }
}
