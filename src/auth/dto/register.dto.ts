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
    default: "test@email.com",
  })
  @IsNotEmpty({ message: "Поле email не должно быть пустым" })
  @IsString({ message: "Поле email должно быть строкой" })
  @MinLength(3, { message: "Минимальная длина поля email 3 символа" })
  @MaxLength(50, { message: "Максимальная длина поля email 32 символа" })
  @IsEmail({}, { message: "Некорректный email" })
  email: string;

  @ApiProperty({
    type: String,
    example: "ФИО пользователя",
    default: "ФИО пользователя",
  })
  @IsNotEmpty({ message: "Поле ФИО не должно быть пустым" })
  @IsString({ message: "Поле ФИО должно быть строкой" })
  @MinLength(5, { message: "Минимальная длина поля ФИО 5 символов" })
  fullName: string;

  @ApiProperty({
    type: String,
    example: "12345678Aa",
    default: "12345678Aa",
  })
  @IsNotEmpty({ message: "Поле пароля не должно быть пустым" })
  @IsString({ message: "Пароль должен быть строкой" })
  @MinLength(8, { message: "Минимальная длина пароля 8 символов" })
  @MaxLength(32, { message: "Максимальная длина пароля 32 символа" })
  @Matches(
    //eslint-disable-next-line
    /^(?=.*[A-ZА-Я])(?=.*[a-zа-я])(?=.*\d)[A-Za-zА-Яа-я0-9~!?@#$%^&*_\-\+\(\)\[\]\{\}><\/\\|"'.,:]+$/,
    {
      message:
        "Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву, одну цифру и может включать только разрешенные специальные символы.",
    },
  )
  password: string;

  @ApiProperty({
    type: String,
    example: "12345678Aa",
    default: "12345678Aa",
  })
  @IsNotEmpty({ message: "Поле passwordRepeat не должно быть пустым" })
  @IsString({ message: "Поле passwordRepeat должно быть строкой" })
  @MinLength(8, { message: "Минимальная длина поля passwordRepeat 8 символов" })
  @MaxLength(32, { message: "Максимальная длина поля passwordRepeat 32 символа" })
  @Validate(IsPasswordsMatchingConstraint, { message: "Пароли не совпадают" })
  passwordRepeat: string;
}
