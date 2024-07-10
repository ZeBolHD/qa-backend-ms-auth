import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({
    type: String,
    example: "test@email.com",
    default: "test@email.com",
  })
  @IsEmail({}, { message: "Некорректный email" })
  @IsNotEmpty({ message: "Поле email не должно быть пустым" })
  @IsString({ message: "Поле email должно быть строкой" })
  @Transform(({ value }) => value.trim())
  @Matches(/^.{4,50}@/, { message: "Некорректный email" })
  @Matches(/^[^&=+<>,_'’"~`!#;:$%^&*()]+$/, {
    message: "Некорректный email",
  })
  email: string;

  @ApiProperty({
    type: String,
    default: "ФИО пользователя",
  })
  @IsString({ message: "Поле fullName должно быть строкой" })
  @MinLength(5, { message: "Минимальная длина fullName 5 символов" })
  readonly fullName: string;

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
    type: Boolean,
    default: true,
  })
  @IsBoolean({ message: "Поле verified должно быть булевым значением" })
  readonly verified: boolean;

  @ApiProperty({
    type: Boolean,
    default: false,
  })
  @IsBoolean({ message: "Поле banned должно быть булевым значением" })
  readonly banned: boolean;
}
