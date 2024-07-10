import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { User } from "@prisma/client";

import { Cookie, Public, UserAgent } from "@common/decorators";
import { UserResponse } from "@user/responses";

import { LoginUserDto, RegisterUserDto } from "./dto";
import { AuthService } from "./auth.service";

import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { LoginResponse } from "./responses";

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
  async register(@Body(new ValidationPipe()) dto: RegisterUserDto) {
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
    type: LoginResponse,
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
  async login(
    @Body() dto: LoginUserDto,
    @UserAgent() userAgent: string,
    @Res() response: Response,
  ) {
    await this.authService.login(dto, userAgent, response);
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
  async logout(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() response: Response) {
    await this.authService.logout(refreshToken, response);
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
    @Res() response: Response,
    @UserAgent() userAgent: string,
  ) {
    await this.authService.refreshTokens(refreshToken, userAgent, response);
  }

  @ApiOperation({
    summary: "Подтверждение email",
    description:
      "Подтверждение email пользователя" +
      "\n\n" +
      "**Roles: USER, ADMIN, SUPER_ADMIN**" +
      "\n\n\n" +
      "Получить токен можно только по **почте** на **prod** сервере",
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
  async confirmEmail(@Query("token") token: string) {
    await this.authService.confirmEmail(token);
  }
}
