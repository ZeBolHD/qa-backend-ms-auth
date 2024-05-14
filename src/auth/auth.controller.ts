import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { User } from "@prisma/client";

import { Cookie, Public, UserAgent } from "@common/decorators";
import { UserResponse } from "@user/responses";

import { LoginDto, RegisterDto } from "./dto";
import { AuthService } from "./auth.service";
import type { Tokens } from "./interfaces";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

const REFRESH_TOKEN = "refresh_token";

@ApiTags("Авторизация")
@Public()
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: "Регистрация пользователя",
    description: "Регистрация пользователя" + "\n\n" + "**Roles: PUBLIC**",
  })
  @ApiResponse({
    status: 201,
    type: UserResponse,
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
  })
  @ApiResponse({
    status: 409,
    description: "Пользователь с таким email уже зарегистрирован",
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @Post("register")
  async register(@Body(new ValidationPipe()) dto: RegisterDto) {
    const user = await this.authService.register(dto);

    if (!user) {
      throw new BadRequestException(
        `Не получается зарегистрировать пользователя с данными ${JSON.stringify(dto)}`,
      );
    }

    return new UserResponse(user as User);
  }

  @ApiOperation({
    summary: "Аутентификация пользователя",
    description: "Аутентификация пользователя" + "\n\n" + "**Roles: PUBLIC**",
  })
  @ApiResponse({
    status: 200,
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
  })
  @ApiResponse({
    status: 401,
    description: "Не верный логин или пароль",
  })
  @ApiResponse({
    status: 403,
    description: "Пользователь не подтверждён",
  })
  @ApiResponse({
    status: 403,
    description: "Пользователь заблокирован",
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  @Post("login")
  async login(@Body() dto: LoginDto, @Res() res: Response, @UserAgent() agent: string) {
    const userWithTokens = await this.authService.login(dto, agent);

    if (!userWithTokens) {
      throw new BadRequestException(
        `Не получается авторизоваться с данными ${JSON.stringify(dto)}`,
      );
    }

    const data = { ...userWithTokens, refreshToken: userWithTokens.refreshToken.token };
    this.setRefreshTokenToCookies(userWithTokens, res, data);
  }

  @ApiOperation({
    summary: "Выход из учётной записи",
    description: "Выход из учётной записи и удаление **refresh_token** пользователя",
  })
  @ApiResponse({
    status: 200,
    description: "Сброс refresh_token пользователя",
  })
  @Get("logout")
  async logout(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() res: Response) {
    if (!refreshToken) {
      res.sendStatus(HttpStatus.OK);
      return;
    }
    await this.authService.deleteRefreshToken(refreshToken);
    res.cookie(REFRESH_TOKEN, "", { httpOnly: true, secure: true, expires: new Date() });
    res.sendStatus(HttpStatus.OK);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: "Обновление токена",
    description:
      "Обновление refreshToken и accessToken пользователя" +
      "\n\n" +
      "**Roles: USER, ADMIN, SUPER_ADMIN**",
  })
  @ApiResponse({
    status: 200,
    description: "Успешное обновление токенов",
  })
  @ApiResponse({
    status: 403,
    description: "Пользователь не авторизован",
  })
  @Get("refresh-tokens")
  async refresh(
    @Cookie(REFRESH_TOKEN) refreshToken: string,
    @Res() res: Response,
    @Req() req: Request,
    @UserAgent() agent: string,
  ) {
    const [type, token] = req.headers.authorization?.split(" ") ?? [];

    if (type === "Refresh") {
      refreshToken = token;
    }

    if (!refreshToken) {
      throw new UnauthorizedException("Пользователь не авторизован");
    }
    const tokens = await this.authService.refreshTokens(refreshToken, agent);

    if (!tokens) {
      throw new UnauthorizedException();
    }

    const expiresIn = this.authService.getExpireTime();

    this.setRefreshTokenToCookies(tokens, res, {
      ...tokens,
      expiresIn,
      refreshToken: tokens.refreshToken.token,
    });
  }

  @ApiOperation({
    summary: "Подтверждение email",
    description:
      "Подтверждение email пользователя" + "\n\n" + "**Roles: USER, ADMIN, SUPER_ADMIN**",
  })
  @ApiParam({
    name: "token",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Пользователь подтверждён",
  })
  @ApiResponse({
    status: 400,
    description: "Неверный токен",
  })
  @Get("confirm")
  async confirmEmail(@Query("token") token: string, @Res() res: Response) {
    await this.authService.confirmEmail(token);
    res.status(HttpStatus.OK).json({ message: "Пользователь подтвержден" });
  }

  private setRefreshTokenToCookies(tokens: Tokens, res: Response, data?: any) {
    if (!tokens) {
      throw new UnauthorizedException();
    }

    res.cookie(REFRESH_TOKEN, tokens.refreshToken.token, {
      httpOnly: true,
      sameSite: "lax",
      expires: new Date(tokens.refreshToken.exp),
      secure: this.configService.get("NODE_ENV", "development") === "production",
      path: "/",
    });

    if (data) {
      res.status(HttpStatus.OK).json({
        ...data,
      });
      return;
    }

    res.status(HttpStatus.OK).json({
      accessToken: tokens.accessToken,
    });
  }
}
