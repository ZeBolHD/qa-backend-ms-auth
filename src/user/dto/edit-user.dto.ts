import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";

export class EditUserDto {
  @ApiProperty({
    description: "Роли пользователя",
    enum: Role,
    default: [Role.USER],
    isArray: true,
    type: [Role],
  })
  @IsOptional()
  @IsArray({ message: "Поле roles должно быть массивом" })
  @IsString({ each: true })
  @IsEnum(Role, {
    each: true,
    message:
      "Каждое значение массиве roles должно быть одним из следующих значений: USER, ADMIN, SUPER_ADMIN",
  })
  readonly roles: Role[];

  @ApiProperty({
    description: "Пользователь подтверждён",
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: "Поле verified должно быть булевым значением" })
  readonly verified: boolean;

  @ApiProperty({
    description: "Пользователь забанен",
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: "Поле banned должно быть булевым значением" })
  readonly banned: boolean;
}
