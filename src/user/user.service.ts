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

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  async create(user: Partial<User>) {
    const hashedPassword = this.hashPassword(user.password);
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    return await this.prismaService.user
      .create({
        data: {
          email: user.email,
          fullName: user.fullName,
          password: hashedPassword,
          verified: isDevelopment,
          banned: user.banned,
          roles: [Role.USER],
        },
        select: {
          email: true,
          fullName: true,
          verified: true,
          roles: true,
          createdAt: true,
        },
      })
      .catch(() => {
        throw new ConflictException("Пользователь с таким email уже зарегистрирован");
      });
  }

  async findAll(dto: FindAllQueryDto) {
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

    return { users, count, page: dto.page, pageSize: dto.pageSize, pageCount };
  }

  async findOne(idOrEmail: string) {
    // if (isReset) {
    //   await this.cacheManager.del(idOrEmail);
    // }

    // const user = await this.cacheManager.get<User>(idOrEmail);
    // if (!user) {
    const user = await this.prismaService.user.findFirst({
      where: {
        OR: [{ id: idOrEmail }, { email: idOrEmail }],
      },
    });

    //   if (!user) {
    //     return null;
    //   }

    //   const sec: number = convertToSecondsUtil(this.configService.get("JWT_EXP"));

    //   await this.cacheManager.set(idOrEmail, user, sec);
    //   return user;
    // }

    return user;
  }

  async delete(id: string, user: JwtPayload) {
    if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException();
    }

    await Promise.all([
      this.prismaService.user.delete({ where: { id }, select: { id: true } }).catch(() => {
        throw new NotFoundException();
      }),

      this.cacheManager.del(id),
      this.cacheManager.del(user.email),
    ]);

    return;
  }

  async edit(id: string, dto: EditUserDto) {
    const _user = this.prismaService.user.findUnique({
      where: {
        id,
      },
    });

    if (!_user) {
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
        throw new BadRequestException("Неверные данные");
      });

    return user;
  }

  async getMe(id: string) {
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
