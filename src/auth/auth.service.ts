import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compareSync } from "bcrypt";
import { add } from "date-fns";
import { v4 } from "uuid";

import { PrismaService } from "@prisma/prisma.service";

import { UserService } from "@user/user.service";

import { MailerService } from "@nestjs-modules/mailer";
import { ConfigService } from "@nestjs/config";

import { LoginDto, RegisterDto } from "./dto";
import { Tokens } from "./interfaces";
import { Token, User } from "@prisma/client";
import { ApiBearerAuth } from "@nestjs/swagger";

import { convertToSecondsUtil } from "@common/utils/";
import { PinoLogger } from "nestjs-pino";

@Injectable()
export class AuthService {
  private readonly isDevelopment = this.configService.get("NODE_ENV") === "development";

  private readonly EMAIL_USER: string = this.configService.get("MAIL_TRANSPORT_USER");
  private readonly FRONTEND_URL = this.configService.get("FRONTEND_URL");
  private readonly EXPIRE_TIME = this.configService.get("JWT_EXP", "5m");

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

  @ApiBearerAuth()
  async refreshTokens(refreshToken: string, agent: string): Promise<Tokens> {
    const token = await this.prismaService.token.findUnique({
      where: {
        token: refreshToken,
      },
    });

    if (!token) {
      this.logger.error("Invalid refresh token");
      throw new UnauthorizedException();
    }

    await this.prismaService.token.delete({
      where: {
        token: refreshToken,
      },
    });

    if (token.exp < new Date()) {
      throw new UnauthorizedException();
    }

    const user = await this.userService.findOne(token.userId);

    this.logger.info(
      {
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles,
          verified: user.verified,
          banned: user.banned,
        },
      },
      "Refreshing tokens for user",
    );

    if (!user.verified) {
      this.logger.error(
        {
          user: {
            id: user.id,
            email: user.email,
            roles: user.roles,
            verified: user.verified,
            banned: user.banned,
          },
        },
        "Refresh failed. User not verified",
      );
      throw new ForbiddenException("Пользователь не подтвержден");
    }

    if (user.banned) {
      this.logger.error(
        {
          user: {
            id: user.id,
            email: user.email,
            roles: user.roles,
            verified: user.verified,
            banned: user.banned,
          },
        },
        "Refresh failed. User banned",
      );
      throw new ForbiddenException("Пользователь заблокирован");
    }

    return this.generateTokens(user, agent);
  }

  async register(dto: RegisterDto) {
    this.logger.info({ user: { email: dto.email, fullName: dto.fullName } }, "Register user");

    const _user: User = await this.userService.findOne(dto.email).catch((err) => {
      this.logger.debug(err, "Failed to find user");
      return null;
    });

    if (_user) {
      this.logger.error(
        { user: { email: dto.email, fullName: dto.fullName } },
        "Registration failed. User already exists with this email",
      );
      throw new ConflictException("Пользователь с таким email уже зарегистрирован");
    }

    const user = await this.userService
      .create({
        ...dto,
        verified: this.isDevelopment,
      })
      .catch((e) => {
        this.logger.debug(e, "Failed to register user");
        return null;
      });

    if (!user) {
      this.logger.error(
        { user: { email: dto.email, fullName: dto.fullName } },
        "Failed to register user",
      );
      throw new BadRequestException("Неверные данные");
    }

    if (!this.isDevelopment) {
      await this.sendConfirmMail(user);
      this.logger.info(
        {
          user: {
            id: user.id,
            email: user.email,
            roles: user.roles,
            verified: user.verified,
            banned: user.banned,
          },
        },
        "Sent confirmation mail",
      );
    }

    this.logger.info(
      {
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles,
          verified: user.verified,
          banned: user.banned,
        },
      },
      "Registered new user",
    );

    return user;
  }

  async login(
    dto: LoginDto,
    agent: string,
  ): Promise<Tokens & { user: Partial<User>; expiresIn: number }> {
    this.logger.info({ user: { email: dto.email } }, "Login user");

    const user: User = await this.userService.findOne(dto.email).catch((e) => {
      this.logger.debug(e, "Login failed. User not found");
      return null;
    });

    if (!user || !compareSync(dto.password, user.password)) {
      this.logger.error({ user: { email: dto.email } }, "Login failed. Invalid credentials");
      throw new UnauthorizedException("Неверный логин или пароль");
    }

    if (!user.verified) {
      this.logger.error(
        {
          user: {
            id: user.id,
            email: user.email,
            roles: user.roles,
            verified: user.verified,
            banned: user.banned,
          },
        },
        "Login failed. User not verified",
      );
      throw new ForbiddenException("Пользователь не подтвержден");
    }

    if (user.banned) {
      this.logger.error(
        {
          user: {
            id: user.id,
            email: user.email,
            roles: user.roles,
            verified: user.verified,
            banned: user.banned,
          },
        },
        "Login failed. User banned",
      );
      throw new ForbiddenException("Пользователь заблокирован");
    }

    const tokens = await this.generateTokens(user, agent);
    const expiresIn = this.getExpireTime();

    this.logger.info(
      {
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles,
          verified: user.verified,
          banned: user.banned,
        },
      },
      "Logged in user",
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles,
      },
      ...tokens,
      expiresIn,
    };
  }

  private async generateTokens(user: User, agent: string): Promise<Tokens> {
    const accessToken = this.jwtService.sign({
      id: user.id,
      email: user.email,
      roles: user.roles,
      verified: user.verified,
    });

    const refreshToken = await this.getRefreshToken(user.id, agent);

    this.logger.info({ user: { id: user.id, email: user.email } }, "Generated tokens for user");

    return {
      accessToken,
      refreshToken,
    };
  }

  private async getRefreshToken(userId: string, agent: string): Promise<Token> {
    const _token = await this.prismaService.token.findFirst({
      where: {
        userId,
        userAgent: agent,
      },
    });

    const token = _token?.token ?? "";

    return this.prismaService.token.upsert({
      where: { token },
      update: {
        token: v4(),
        exp: add(new Date(), { months: 1 }),
      },
      create: {
        token: v4(),
        exp: add(new Date(), { months: 1 }),
        userId,
        userAgent: agent,
      },
    });
  }

  deleteRefreshToken(token: string) {
    return this.prismaService.token.delete({
      where: {
        token: token,
      },
    });
  }

  async sendConfirmMail(user: User) {
    this.logger.info({ user: { id: user.id, email: user.email } }, "Sending confirmation mail");

    const token = v4();
    await this.prismaService.userMailConfirmation.create({
      data: {
        email: user.email,
        token,
      },
    });

    const confirmationUrl = `${this.FRONTEND_URL}/confirm?token=${token}`;

    return await this.mailerService.sendMail({
      to: user.email,
      from: this.EMAIL_USER,
      subject: "Подтверждение регистрации",
      text: "Подтвердите регистрацию",
      html: `<div>
        <h1>Подтвердите регистрацию</h1>
        <p>Перейдите по ссылке для подтверждения регистрации</p>
        <a href="${confirmationUrl}">Подтвердить регистрацию</a>
      </div>`,
    });
  }

  async confirmEmail(token: string) {
    this.logger.info({ confirmToken: token }, `Confirming email`);
    if (!token) {
      this.logger.error("No token provided or invalid token");
      throw new BadRequestException("Неверный токен");
    }

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

    return {
      message: "Пользователь подтвержден",
    };
  }

  getExpireTime(): number {
    const milliseconds = convertToSecondsUtil(this.EXPIRE_TIME) * 1000;
    const time = new Date().setTime(new Date().getTime() + milliseconds);
    return time;
  }
}
