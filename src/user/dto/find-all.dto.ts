import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsOptional, Max, Min } from "class-validator";

enum Sort {
  ASC = "asc",
  DESC = "desc",
}

export class FindAllQueryDto {
  @ApiProperty({
    minimum: 1,
    maximum: 20,
    title: "pageSize",
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "Поле pageSize должно быть числом" })
  @Min(1, { message: "Поле pageSize имеет минимальную величину 1" })
  @Max(20, { message: "Поле pageSize имеет максимальную величину 20" })
  readonly pageSize: number = 10;

  @ApiProperty({
    minimum: 1,
    title: "page",
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "Поле page должно быть числом" })
  @Min(1, { message: "Поле page имеет минимальную величину 1" })
  readonly page: number = 1;

  @ApiProperty({
    enum: Role,
    isArray: true,
    example: Object.keys(Role),
    required: false,
  })
  @IsOptional()
  @IsArray({ message: "Поле roles должен быть массивом" })
  @IsEnum(Role, {
    each: true,
    message: "Поле roles может принимать только USER, ADMIN, SUPER_ADMIN",
  })
  readonly roles: Role[] = Object.values(Role);

  @ApiProperty({
    type: String,
    title: "createdAt",
    default: "asc",
    required: false,
    enum: Sort,
  })
  @IsOptional()
  @IsEnum(Sort, { message: "Поле createdAt может принимать только asc или desc" })
  @Transform(({ value }) => (typeof value === "string" && value ? value : "asc"))
  readonly createdAt: "asc" | "desc" = "desc";
}
