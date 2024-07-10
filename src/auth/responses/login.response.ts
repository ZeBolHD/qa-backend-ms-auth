import { ApiProperty } from "@nestjs/swagger";
import { UserResponse } from "@user/responses";

export class LoginResponse {
  @ApiProperty({
    example: {
      id: "8cbabbe9-5fff-4dbe-a77e-104bf4e63dbe",
      email: "test@mail.ru",
      roles: ["USER"],
      verified: true,
      banned: false,
    },
    description: "Данные пользователя",
    type: UserResponse,
  })
  user: UserResponse;

  @ApiProperty({
    example:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJjM2FlYjdlLWI4YTUtNDNlYi05Y2I1LWNjMjBmMWViMWFhOCIsImVtYWlsIjoidGVzdEBlbWFpbC5jb20iLCJyb2xlcyI6WyJVU0VSIl0sInZlcmlmaWVkIjp0cnVlLCJpYXQiOjE3MjA1MjEzMDUsImV4cCI6MTcyMDUyMzEwNX0.4NNJpCP6HjRI2S6ZJqpv5H7WJueFpYd9Jh2_h6OtO2E",
    description: "Токен доступа",
    type: String,
  })
  accessToken: string;

  @ApiProperty({
    example: 1720522235400,
    description: "Время жизни токена",
    type: Number,
  })
  expiresIn: number;

  constructor(user: UserResponse, accessToken: string, expiresIn: number) {
    this.user = user;
    this.accessToken = accessToken;
    this.expiresIn = expiresIn;
  }
}
