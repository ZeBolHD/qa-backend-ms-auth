import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
} from "class-validator";

import { IsPasswordsMatchingConstraint } from "@common/decorators";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    type: String,
    example: "test@email.com",
  })
  @IsString({ message: "Поле email должно быть строкой" })
  @MinLength(3, { message: "Минимальная длина email 3 символа" })
  @MaxLength(50, { message: "Максимальная длина email 32 символа" })
  @IsEmail({}, { message: "Некорректный email" })
  email: string;

  @ApiProperty({
    type: String,
    example: "ФИО пользователя",
  })
  @IsNotEmpty({ message: "Поле ФИО не должно быть пустым" })
  @IsString({ message: "Поле ФИО должно быть строкой" })
  @MinLength(5, { message: "Минимальная длина ФИО 5 символов" })
  fullName: string;

  @ApiProperty({
    type: String,
    example: "12345678Aa",
  })
  @Matches(/^(?=.*[a-zA-Zа-яА-Я])(?=.*\d)[a-zA-Zа-яА-Я\d?@#$%^&*_\-+()\[\]{}><\\/\\|"'.,:;]{8,20}$/)
  @IsString({ message: "Пароль должен быть строкой" })
  @MinLength(8, { message: "Минимальная длина пароля 8 символов" })
  @MaxLength(32, { message: "Максимальная длина пароля 32 символа" })
  password: string;

  @ApiProperty({
    type: String,
    example: "12345678Aa",
  })
  @IsString({ message: "Пароль должен быть строкой" })
  @MinLength(8, { message: "Минимальная длина пароля 8 символов" })
  @MaxLength(32, { message: "Максимальная длина пароля 32 символа" })
  @Validate(IsPasswordsMatchingConstraint, { message: "Пароли не совпадают" })
  passwordRepeat: string;
}
