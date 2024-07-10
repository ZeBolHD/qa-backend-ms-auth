import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcrypt";
import { add } from "date-fns";
import { v4 } from "uuid";
import { PinoLogger } from "nestjs-pino";
import { Token, User } from "@prisma/client";

import type { Response } from "express";
import { PrismaService } from "@prismadb/prisma.service";

import { UserService } from "@user/user.service";

import { MailerService } from "@nestjs-modules/mailer";
import { ConfigService } from "@nestjs/config";
import { convertToSecondsUtil, omit } from "@common/utils/";

import { LoginUserDto, RegisterUserDto } from "./dto";
import { Tokens } from "./interfaces";

@Injectable()
export class AuthService {
  private readonly isProduction = this.configService.get("NODE_ENV") === "production";
  private readonly EMAIL_USER: string = this.configService.get("MAIL_TRANSPORT_USER");
  private readonly FRONTEND_URL = this.configService.get("FRONTEND_URL");
  private readonly EXPIRE_TIME = this.configService.get("JWT_EXP", "5m");
  private readonly REFRESH_TOKEN = "refresh_token";

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async register(dto: RegisterUserDto) {
    this.logger.info({ user: { email: dto.email, fullName: dto.fullName } }, "Register user");

    if (await this.userService.checkIsUserExist({ email: dto.email })) {
      this.logger.error(
        { user: { email: dto.email, fullName: dto.fullName } },
        "Failed to register user. User already exists with the same email.",
      );
      throw new ConflictException("Пользователь с таким email уже зарегистрирован");
    }

    const user = await this.userService
      .create({ ...dto, verified: !this.isProduction, banned: false })
      .catch((e) => {
        this.logger.debug(e, "Failed to register user");
        this.logger.error(
          { user: { email: dto.email, fullName: dto.fullName } },
          "Failed to register user",
        );
        throw new InternalServerErrorException("Возникла ошибка при создании пользователя");
      });

    if (this.isProduction) {
      //Отправка письма с подтверждением регистрации
      try {
        await this.sendConfirmationMail(user);
        this.logger.info({ user: { id: user.id, email: user.email } }, "Sent confirmation mail");
      } catch (e) {
        this.logger.error(e, "Failed to send email");

        //Если не удалось отправить письмо, то удаляем пользователя
        await this.userService.delete(user.id);

        throw new InternalServerErrorException("Возникла при регистрации пользователя");
      }
    }

    this.logger.info(
      {
        user: omit(user),
      },
      "Registered new user",
    );

    return user;
  }

  async login(dto: LoginUserDto, userAgent: string, response: Response) {
    this.logger.info({ user: { email: dto.email } }, "Login user");

    //Поиск пользователя
    const user = await this.userService.findOne({ email: dto.email }).catch((e) => {
      this.logger.debug(e, "Login failed. User not found");
      throw new InternalServerErrorException("Возникла ошибка при авторизации");
    });

    this.logger.debug({ user: { email: dto.email } }, "Comparing passwords");

    //Проверка пароля
    if (!user || !(await compare(dto.password, user.password))) {
      this.logger.error({ user: { email: dto.email } }, "Login failed. Invalid credentials");
      throw new UnauthorizedException("Неверный логин или пароль");
    }

    const userLog = omit(user, "password", "updatedAt", "createdAt");

    this.logger.debug({ user: userLog }, "Checking if user is verified or banned");

    if (!user.verified) {
      this.logger.error(
        {
          user: userLog,
        },
        "Login failed. User not verified",
      );
      throw new ForbiddenException("Пользователь не подтвержден");
    }

    if (user.banned) {
      this.logger.error(
        {
          user: userLog,
        },
        "Login failed. User banned",
      );
      throw new ForbiddenException("Пользователь заблокирован");
    }

    this.logger.debug({ user: userLog }, "Generating tokens");

    //Генерируем пару токенов
    const { accessToken, refreshToken } = await this.generateTokens(user, userAgent);

    this.logger.info(
      {
        user: userLog,
      },
      "Logged in user",
    );

    this.setRefreshTokenToCookies(refreshToken, response);

    response.status(200).send({
      user: omit(user, "password", "updatedAt"),
      accessToken: accessToken.token,
      expiresIn: accessToken.expiresIn,
    });
  }

  async refreshTokens(refreshToken: string, userAgent: string, response: Response) {
    if (!refreshToken) {
      this.logger.error("Invalid refresh token");
      throw new UnauthorizedException("Неверный токен");
    }

    const token = await this.prismaService.token.findUnique({
      where: {
        token: refreshToken,
      },
    });

    //Проверка жизни токена
    if (!token || token.expiresIn < new Date()) {
      this.logger.error("Invalid refresh token");
      throw new UnauthorizedException("Неверный токен");
    }

    const user = await this.userService.findOne({ id: token.userId });

    const userLog = omit(user, "password", "updatedAt", "createdAt");
    this.logger.info(
      {
        user: userLog,
      },
      "Refreshing tokens for user",
    );

    if (!user.verified) {
      this.logger.error(
        {
          user: userLog,
        },
        "Refresh failed. User not verified",
      );
      throw new ForbiddenException("Пользователь не подтвержден");
    }

    if (user.banned) {
      this.logger.error(
        {
          user: userLog,
        },
        "Refresh failed. User banned",
      );
      throw new ForbiddenException("Пользователь заблокирован");
    }

    const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(
      user,
      userAgent,
    );

    this.setRefreshTokenToCookies(newRefreshToken, response);

    response.status(HttpStatus.OK).send({
      accessToken: accessToken.token,
      expiresIn: accessToken.expiresIn,
    });
  }

  async logout(refreshToken: string, response: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException("Неверный токен");
    }

    const _token = await this.prismaService.token
      .delete({
        where: {
          token: refreshToken,
        },
        select: {
          userId: true,
        },
      })
      .catch((e) => {
        this.logger.debug(e, "Failed to delete refresh token");
        this.logger.error({ refreshToken }, "Failed to delete refresh token");
        throw new InternalServerErrorException("Возникла ошибка при выходе пользователя");
      });

    if (!_token) {
      this.logger.error({ refreshToken }, "Failed to delete refresh token");
      throw new UnauthorizedException("Неверный токен");
    }

    this.logger.info({ user: { id: _token.userId } }, "User logged out");

    response.clearCookie(this.REFRESH_TOKEN);

    response.status(HttpStatus.OK).send({ message: "Вы вышли из учётной записи" });
  }

  async confirmEmail(token: string) {
    this.logger.info({ confirmToken: token }, `Confirming email`);

    const userMailConfirmation = await this.prismaService.userMailConfirmation
      .delete({
        where: {
          token: token,
        },
      })
      .catch(() => {
        this.logger.error({ confirmToken: token }, "Invalid token");
        throw new BadRequestException("Неверный токен");
      });

    const user = await this.prismaService.user.update({
      where: {
        email: userMailConfirmation.email,
      },
      data: {
        verified: true,
      },
    });

    this.logger.info({ user: { id: user.id, email: user.email } }, "Confirmed email");

    return { message: "Пользователь подтвержден" };
  }

  private async generateTokens(user: User, userAgent?: string): Promise<Tokens> {
    const accessToken = {
      token: this.jwtService.sign({
        id: user.id,
        email: user.email,
        roles: user.roles,
        verified: user.verified,
      }),
      expiresIn: this.getExpireTime(),
    };

    const refreshToken = await this.getRefreshToken(user.id, userAgent);

    this.logger.info({ user: { id: user.id, email: user.email } }, "Generated tokens for user");

    return {
      accessToken,
      refreshToken,
    };
  }

  private async getRefreshToken(userId: string, userAgent: string): Promise<Token> {
    const _token = await this.prismaService.token.findFirst({
      where: {
        userId,
        userAgent,
      },
    });

    const token = _token?.token ?? "";

    return this.prismaService.token.upsert({
      where: { token },
      update: {
        token: v4(),
        expiresIn: add(new Date(), { months: 1 }),
      },
      create: {
        token: v4(),
        expiresIn: add(new Date(), { months: 1 }),
        userId,
        userAgent,
      },
    });
  }

  private async sendConfirmationMail(user: Pick<User, "id" | "email">) {
    this.logger.info({ user: { id: user.id, email: user.email } }, "Sending confirmation mail");

    const token = v4();

    this.logger.debug(
      { user: { id: user.id, email: user.email } },
      "Generated email confirmation token",
    );

    await this.prismaService.userMailConfirmation.create({
      data: {
        email: user.email,
        token,
      },
    });

    const confirmationUrl = `${this.FRONTEND_URL}/confirm?token=${token}`;

    this.logger.debug(
      { user: { id: user.id, email: user.email } },
      "Sending to email confirmation mail",
    );

    await this.mailerService
      .sendMail({
        to: user.email,
        from: this.EMAIL_USER,
        subject: "Подтверждение регистрации",
        text: "Подтвердите регистрацию",
        html: `<div>
        <h1>Подтвердите регистрацию</h1>
        <p>Перейдите по ссылке для подтверждения регистрации</p>
        <a href="${confirmationUrl}">Подтвердить регистрацию</a>
      </div>`,
      })
      .catch(() => {
        this.logger.error(
          { user: { id: user.id, email: user.email } },
          "Failed to send confirmation mail",
        );
        throw new InternalServerErrorException("Возникла ошибка при отправке письма");
      });

    this.logger.info({ user: { id: user.id, email: user.email } }, "Sent confirmation mail");
  }

  getExpireTime(): number {
    const milliseconds = convertToSecondsUtil(this.EXPIRE_TIME) * 1000;
    const time = new Date().setTime(new Date().getTime() + milliseconds);
    return time;
  }

  private setRefreshTokenToCookies(token: Token, response: Response) {
    response.cookie(this.REFRESH_TOKEN, token.token, {
      httpOnly: true,
      sameSite: "lax",
      expires: new Date(token.expiresIn),
      secure: this.configService.get("NODE_ENV", "development") === "production",
      path: "/",
    });
  }
}
