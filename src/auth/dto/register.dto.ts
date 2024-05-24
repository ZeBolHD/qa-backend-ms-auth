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
import { Transform } from "class-transformer";

export class RegisterDto {
  @ApiProperty({
    type: String,
    example: "test@email.com",
    default: "test@email.com",
  })
  @IsNotEmpty({ message: "Поле email не должно быть пустым" })
  @IsString({ message: "Поле email должно быть строкой" })
  @Transform(({ value }) => value.trim())
  @IsEmail({}, { message: "Некорректный email" })
  @Matches(/^.{4,50}@/, { message: "Некорректный email" })
  @Matches(/^[^&=+<>,_'’"~`!#;:$%^&*()]+$/, {
    message: "Некорректный email",
  })
  email: string;

  @ApiProperty({
    type: String,
    example: "ФИО пользователя",
    default: "ФИО пользователя",
  })
  @IsNotEmpty({ message: "Поле ФИО не должно быть пустым" })
  @IsString({ message: "Поле ФИО должно быть строкой" })
  @Transform(({ value }) => value.trim())
  @MinLength(5, { message: "Минимальная длина поля ФИО 5 символов" })
  @Matches(/^[A-Za-zА-Яа-я\s]+$/, {
    message: "Поле ФИО должно содержать только буквы и пробелы",
  })
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
  @Transform(({ value }) => value.trim())
  @Matches(/[A-ZА-Я]/, {
    message: "Пароль должен содержать хотя бы одну заглавную букву",
  })
  @Matches(/[a-zа-я]/, {
    message: "Пароль должен содержать хотя бы одну строчную букву",
  })
  @Matches(/\d/, {
    message: "Пароль должен содержать хотя бы одну цифру",
  })
  @Matches(/^[^ ]*$/, {
    message: "Пароль не должен содержать пробелов",
  })
  //eslint-disable-next-line
  @Matches(/^[A-Za-zА-Яа-я0-9~!?@#$%^&*_\-\+\(\)\[\]\{\}><\/\\|"'.,:]+$/, {
    message:
      "Пароль может содержать только буквы, цифры, спецсимволы и знаки: ~!?@#$%^&*_-+()[{}><>/\\|\"'.,:]",
  })
  password: string;

  @ApiProperty({
    type: String,
    example: "12345678Aa",
    default: "12345678Aa",
  })
  @IsNotEmpty({ message: "Поле passwordRepeat не должно быть пустым" })
  @IsString({ message: "Поле passwordRepeat должно быть строкой" })
  @Transform(({ value }) => value.trim())
  @Validate(IsPasswordsMatchingConstraint, { message: "Пароли не совпадают" })
  passwordRepeat: string;
}
