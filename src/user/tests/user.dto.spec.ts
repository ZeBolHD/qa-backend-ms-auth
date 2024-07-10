import { omit, pick } from "@common/utils";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { User } from "@prisma/client";
import { CreateUserDto, EditUserDto, FindAllQueryDto } from "@user/dto";

describe("UserDto", () => {
  const target: ValidationPipe = new ValidationPipe({ whitelist: true, transform: true });
  let userDto: User;

  beforeEach(() => {
    userDto = {
      id: "test-id",
      email: "email@example.com",
      fullName: "fullName",
      password: "12345678Aa",
      roles: ["USER"],
      banned: false,
      verified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("CreateUserDto", () => {
    it("should validate dto", async () => {
      const dto = omit(userDto, "id", "createdAt", "updatedAt", "roles");
      expect(await target.transform(dto, { type: "body", metatype: CreateUserDto })).toEqual(dto);
    });

    it("should validate dto with valid password", async () => {
      const dto = omit(userDto, "id", "createdAt", "updatedAt", "roles");

      const correctPassword = [
        "12345678Aa",
        "12345678Aa1",
        "@123456Aa",
        "______1Aa",
        "._._.1A8adf+",
        "12345678Aa12345",
      ];

      for (const password of correctPassword) {
        await expect(
          target.transform({ ...dto, password }, { type: "body", metatype: CreateUserDto }),
        ).resolves.toEqual({ ...dto, password });
      }
    });

    it("should not validate dto with wrong password", async () => {
      const dto = omit(userDto, "id", "createdAt", "updatedAt", "roles");

      const wrongPassword = [
        "123",
        "1234567812312",
        "123456_as",
        "@@@!!!!!!!!!`",
        "______________",
        "asdfasdfasdfasdAa",
        "   asdasd   ",
      ];

      for (const password of wrongPassword) {
        await expect(
          target.transform({ ...dto, password }, { type: "body", metatype: CreateUserDto }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it("should not validate with wrong email", async () => {
      const dto = omit(userDto, "id", "createdAt", "updatedAt", "roles");

      const wrongEmails = [
        "email",
        "firstname.lastname",
        "email@subdomain",
        "firstname+lastname",
        "email@123.123.123.123",
        "email@[123.123.123.123]",
        "email@example",
        "_______@example",
        "email@example.",
        "firstname-lastname",
      ];

      for (const email of wrongEmails) {
        await expect(
          target.transform({ ...dto, email }, { type: "body", metatype: CreateUserDto }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it("should validate with wrong email", async () => {
      const dto = omit(userDto, "id", "createdAt", "updatedAt", "roles");

      const validEmails = [
        "email@example.com",
        "firstname.lastname@example.com",
        "email@subdomain.example.com",
        "firstnamelastname@example.com",
      ];

      for (const email of validEmails) {
        await expect(
          await target.transform({ ...dto, email }, { type: "body", metatype: CreateUserDto }),
        ).toEqual({ ...dto, email });
      }
    });
  });

  describe("FindAllQueryDto", () => {
    it("should validate dto", async () => {
      const query = {
        page: 1,
        pageSize: 1,
        roles: ["USER", "ADMIN"],
        createdAt: "asc",
      } as FindAllQueryDto;
      await expect(
        await target.transform(query, { type: "query", metatype: FindAllQueryDto }),
      ).toEqual(query);
    });

    it("should validate empty dto", async () => {
      const query = new FindAllQueryDto();
      await expect(
        await target.transform(query, { type: "query", metatype: FindAllQueryDto }),
      ).toEqual(query);
    });

    it("should not validate dto with wrong page and pageSize", async () => {
      const query = { page: -1, pageSize: -1 } as FindAllQueryDto;
      await expect(
        target.transform(query, { type: "query", metatype: FindAllQueryDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should not validate dto with wrong sort type", async () => {
      const query = { createdAt: "wrong" };
      await expect(
        target.transform(query, { type: "query", metatype: FindAllQueryDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should not validate dto with wrong roles", async () => {
      const query = { roles: ["wrong"] };
      await expect(
        target.transform(query, { type: "query", metatype: FindAllQueryDto }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("EditUserDto", () => {
    it("should validate dto", async () => {
      const dto: EditUserDto = pick(userDto, "banned", "verified", "roles");

      expect(await target.transform(dto, { type: "body", metatype: EditUserDto })).toEqual(dto);
    });

    it("should not validate dto with wrong roles", async () => {
      const dto: EditUserDto = pick(userDto, "banned", "verified", "roles");

      await expect(
        target.transform({ ...dto, roles: ["wrong"] }, { type: "body", metatype: EditUserDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should not validate dto with wrong banned and verified", async () => {
      const dto: EditUserDto = pick(userDto, "banned", "verified", "roles");

      await expect(
        target.transform(
          { ...dto, banned: "wrong", verified: "wrong" },
          {
            type: "body",
            metatype: EditUserDto,
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
