import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class LoginUserDto {
  @ApiProperty({
    type: String,
    example: "test@email.com",
  })
  @IsString({ message: "Поле email должно быть строкой" })
  @IsEmail({}, { message: "Поле email не соответствует" })
  email: string;

  @ApiProperty({
    type: String,
    example: "12345678Aa",
  })
  @IsString({ message: "Поле password должно быть строкой" })
  password: string;
}
