import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { CurrentUser, Roles } from "@common/decorators";

import type { JwtPayload } from "@auth/interfaces";
import { RolesGuard } from "@auth/guards/role.guard";

import { Role } from "@prisma/client";
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { FinAllUsersResponse, UserResponse } from "./responses";
import { UserService } from "./user.service";
import { CreateUserDto, EditUserDto, FindAllQueryDto } from "./dto";

@ApiTags("Пользователь")
@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiExcludeEndpoint()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({
    summary: "Получение информации о пользователе по токену",
    description:
      "Получение информации о пользователе по токену" +
      "\n\n" +
      "**Roles: USER, ADMIN, SUPER_ADMIN**",
  })
  @ApiResponse({
    status: 200,
    type: UserResponse,
  })
  @ApiResponse({
    status: 403,
    description: "У вас нет прав для данного действия",
  })
  @Get("me")
  async me(@CurrentUser() user: JwtPayload) {
    return await this.userService.findOne({ id: user.id });
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: "Получение информации о пользователе",
    description: "Получение информации о пользователе" + "\n\n" + "**Roles: ADMIN, SUPER_ADMIN**",
  })
  @ApiParam({
    name: "idOrEmail",
    type: String,
    example: "8cbabbe9-5fff-4dbe-a77e-104bf4e63dbe",
  })
  @ApiResponse({
    status: 200,
    type: UserResponse,
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  @ApiResponse({
    status: 403,
    description: "У вас нет прав для данного действия",
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @Get(":idOrEmail")
  async findOneUser(@Param("idOrEmail") idOrEmail: string) {
    const user = await this.userService.findOne({ id: idOrEmail, email: idOrEmail });
    return new UserResponse(user);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({
    summary: "Удаление пользователя",
    description:
      "Удаление пользователя" +
      "\n\n" +
      "USER может удалить только себя" +
      "\n\n" +
      "**Roles: USER, ADMIN, SUPER_ADMIN**",
  })
  @ApiParam({
    name: "id",
    type: String,
    example: "8cbabbe9-5fff-4dbe-a77e-104bf4e63dbe",
  })
  @ApiResponse({
    status: 200,
    type: UserResponse,
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  @ApiResponse({
    status: 403,
    description: "У вас нет прав для данного действия",
  })
  @Delete(":id")
  async deleteUser(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return await this.userService.delete(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: "Создание пользователя",
    description: "Создание пользователя" + "\n\n" + "**Roles: ADMIN, SUPER_ADMIN**",
  })
  @ApiResponse({
    status: 201,
    type: UserResponse,
  })
  @ApiResponse({
    status: 409,
    description: "Пользователь с таким email уже зарегистрирован",
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
  })
  @ApiResponse({
    status: 403,
    description: "У вас нет прав для данного действия",
  })
  @Post()
  async create(@Body(new ValidationPipe()) dto: CreateUserDto) {
    return await this.userService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: "Изменение данных пользователя",
    description: "Изменение данных пользователя" + "\n\n" + "**Roles: ADMIN, SUPER_ADMIN**",
  })
  @ApiParam({
    name: "id",
    type: String,
    example: "8cbabbe9-5fff-4dbe-a77e-104bf4e63dbe",
  })
  @ApiResponse({
    status: 200,
    type: UserResponse,
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
  })
  @ApiResponse({
    status: 403,
    description: "У вас нет прав для данного действия",
  })
  @Patch(":id")
  async edit(@Param("id") id: string, @Body(new ValidationPipe()) dto: EditUserDto) {
    return await this.userService.edit(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )
  @ApiOperation({
    summary: "Получение списка пользователей",
    description: "Получение списка пользователей" + "\n\n" + "**Roles: ADMIN, SUPER_ADMIN**",
  })
  @ApiResponse({
    status: 200,
    type: [FinAllUsersResponse],
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
  })
  @ApiResponse({
    status: 403,
    description: "У вас нет прав для данного действия",
  })
  @Get()
  async findAll(@Query() query: FindAllQueryDto) {
    return this.userService.findAll(query);
  }
}
