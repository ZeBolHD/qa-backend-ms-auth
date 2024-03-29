import { ApiProperty } from "@nestjs/swagger";
import { Role, User } from "@prisma/client";
import { Exclude } from "class-transformer";

export class UserResponse implements User {
  @ApiProperty({
    example: "8cbabbe9-5fff-4dbe-a77e-104bf4e63dbe",
    description: "Идентификатор пользователя",
    type: String,
  })
  id: string;

  @ApiProperty({
    example: "test@mail.ru",
    description: "Идентификатор пользователя",
    type: String,
  })
  email: string;

  @ApiProperty({
    example: "ФИО пользователя",
  })
  fullName: string;

  @ApiProperty({
    default: ["USER"],
    isArray: true,
    enum: Role,
  })
  roles: Role[];

  @ApiProperty({
    type: Boolean,
    default: true,
  })
  verified: boolean;

  @Exclude()
  password: string;

  @ApiProperty({
    type: Date,
    default: "2024-03-02T05:37:47.298Z",
  })
  createdAt: Date;

  @ApiProperty({
    type: Boolean,
    default: false,
  })
  banned: boolean;

  @Exclude()
  updatedAt: Date;

  constructor(user: User) {
    Object.assign(this, user);
  }
}
