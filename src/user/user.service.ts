import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { hashSync, genSaltSync } from "bcrypt";

import { Role, User } from "@prisma/client";
import { PrismaService } from "@prismadb/prisma.service";
import { JwtPayload } from "@auth/interfaces";
import { ConfigService } from "@nestjs/config";

import { CreateUserDto, EditUserDto, FindAllQueryDto } from "./dto";
import { PinoLogger } from "nestjs-pino";
import { omit } from "@common/utils";

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserService.name);
  }

  async create(dto: CreateUserDto): Promise<Omit<User, "password" | "updatedAt">> {
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    const userLog = omit(dto, "password");

    this.logger.info(
      {
        user: userLog,
      },
      "Create user",
    );

    if (await this.checkIsUserExist({ email: dto.email })) {
      this.logger.error(
        {
          user: userLog,
        },
        "Failed to create user. User already exists with the same email.",
      );
      throw new ConflictException("Пользователь с таким email уже зарегистрирован");
    }

    this.logger.debug(
      {
        user: userLog,
      },
      "Hashing password",
    );

    const hashedPassword = this.hashPassword(dto.password);

    this.logger.debug(
      {
        user: userLog,
      },
      "Creating user",
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
          "Failed to create user. Wrong data",
        );
        throw new InternalServerErrorException("Возникла ошибка при создании пользователя");
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

    this.logger.debug({ query: dto }, "Finding all users");

    const users = await this.prismaService.user
      .findMany({
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
      })
      .catch((e) => {
        this.logger.error(e, "Failed to find all users");

        this.logger.error({ query: dto }, "Failed to find all users. Wrong data");
        throw new BadRequestException("Неверные данные запроса");
      });

    this.logger.debug({ users }, "Found all users");

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

  async findOne({ id, email }: { id?: string; email?: string }) {
    this.logger.debug({ user: { id, email } }, "Finding one user");

    return await this.prismaService.user.findFirst({
      where: {
        OR: [{ id: id }, { email: email }],
      },
    });
  }

  async delete(id: string, userPayload?: JwtPayload) {
    this.logger.info({ user: { id } }, "Delete user");

    if (userPayload && userPayload.id !== id && !userPayload.roles.includes(Role.ADMIN)) {
      this.logger.error(
        { user: { id } },
        "Failed to delete user. User is not allowed to delete other users",
      );
      throw new ForbiddenException();
    }

    if (!(await this.checkIsUserExist({ id }))) {
      this.logger.error({ user: { id } }, "Failed to delete user. User not found");
      throw new NotFoundException("Пользователь не найден");
    }

    this.logger.debug({ user: { id } }, "Deleting user");

    const user = await this.prismaService.user
      .delete({
        where: { id },
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
      .catch(() => {
        this.logger.debug({ user: { id } }, "Failed to delete user");
        this.logger.error({ user: { id } }, "Failed to delete user. Wrong data");
        throw new InternalServerErrorException("Возникла ошибка при удалении пользователя");
      });

    this.logger.info({ user: { id } }, "Deleted user");

    return user;
  }

  async edit(id: string, dto: EditUserDto) {
    this.logger.info({ user: { id, ...dto } }, "Edit user");

    if (!(await this.checkIsUserExist({ id }))) {
      this.logger.error({ user: { id, ...dto } }, "Failed to edit user. User not found");
      throw new NotFoundException("Пользователь не найден");
    }

    this.logger.debug({ user: { id, ...dto } }, "Editing user");

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

    if (!(await this.checkIsUserExist({ id }))) {
      this.logger.error({ user: { id } }, "Failed to get user by access token. User not found");
      throw new NotFoundException("Пользователь не найден");
    }

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
        this.logger.error({ user: { id } }, "Failed to get user by access token");
        throw new InternalServerErrorException("Возникла ошибка при получении пользователя");
      });
  }

  private hashPassword(password: string) {
    return hashSync(password, genSaltSync(10));
  }

  async checkIsUserExist({ email, id }: { email?: string; id?: string }) {
    this.logger.debug({ user: { email, id } }, "Check is user exist");

    const user = await this.prismaService.user
      .findUnique({
        where: {
          email,
          id,
        },
      })
      .catch((e) => {
        this.logger.debug(e, "Failed to find user");
        this.logger.error({ user: { email, id } }, "Failed to find user. User not found");
        return null;
      });

    return user !== null;
  }
}
