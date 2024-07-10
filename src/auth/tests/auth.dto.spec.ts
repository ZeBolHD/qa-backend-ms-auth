import { LoginUserDto, RegisterUserDto } from "@auth/dto";
import { pick } from "@common/utils";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { User } from "@prisma/client";

describe("AuthDto", () => {
  const target: ValidationPipe = new ValidationPipe({ whitelist: true, transform: true });
  let userDto: User & RegisterUserDto;

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
      passwordRepeat: "12345678Aa",
    };
  });

  describe("RegisterUserDto", () => {
    it("should validate dto", async () => {
      const dto: RegisterUserDto = {
        ...pick(userDto, "email", "password", "fullName", "passwordRepeat"),
      };
      expect(await target.transform(dto, { type: "body", metatype: RegisterUserDto })).toEqual(dto);
    });

    it("should validate dto with valid passwords", async () => {
      const dto = pick(userDto, "email", "password", "fullName");

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
          target.transform(
            { ...dto, password, passwordRepeat: password },
            { type: "body", metatype: RegisterUserDto },
          ),
        ).resolves.toEqual({ ...dto, password, passwordRepeat: password });
      }
    });

    it("should not validate dto with wrong password", async () => {
      const dto = pick(userDto, "email", "password", "fullName", "passwordRepeat");

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
          target.transform({ ...dto, password }, { type: "body", metatype: RegisterUserDto }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it("should validate dto with valid email", async () => {
      const dto = pick(userDto, "email", "password", "fullName", "passwordRepeat");

      const validEmails = [
        "email@example.com",
        "firstname.lastname@example.com",
        "email@subdomain.example.com",
        "firstnamelastname@example.com",
      ];

      for (const email of validEmails) {
        await expect(
          await target.transform({ ...dto, email }, { type: "body", metatype: RegisterUserDto }),
        ).toEqual({ ...dto, email });
      }
    });

    it("should not validate dto with wrong email", async () => {
      const dto = pick(userDto, "email", "password", "fullName");

      const wrongEmails = [
        "email",
        "firstname.lastname",
        "email@subdomain",
        "firstname+lastname",
        "email@123.123.123.123",
        "email@[123.123.123.123]",
        "1234567890@example.com",
        "email@example",
        "_______@example",
        "email@example.",
        "email@example.name",
        "email@example.museum",
        "email@example.co.jp",
        "firstname-lastname",
      ];

      for (const email of wrongEmails) {
        await expect(
          target.transform({ ...dto, email }, { type: "body", metatype: RegisterUserDto }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it("should validate dto with valid fullName", async () => {
      const dto = pick(userDto, "email", "password", "fullName", "passwordRepeat");

      const wrongFullNames = [
        "testName",
        "testName test",
        "testName test test",
        "Русское Имя",
        "Кристина",
      ];

      for (const fullName of wrongFullNames) {
        expect(
          await target.transform({ ...dto, fullName }, { type: "body", metatype: RegisterUserDto }),
        ).toEqual({ ...dto, fullName });
      }
    });

    it("should not validate dto with wrong fullName", async () => {
      const dto = pick(userDto, "email", "password", "fullName", "passwordRepeat");

      const wrongFullNames = ["23", "    test   ", "_asda  asdasd", " ", "123153456456"];

      for (const fullName of wrongFullNames) {
        await expect(
          target.transform({ ...dto, fullName }, { type: "body", metatype: RegisterUserDto }),
        ).rejects.toThrow(BadRequestException);
      }
    });
  });

  describe("LoginUserDto", () => {
    it("should validate dto", async () => {
      const dto = pick(userDto, "email", "password");

      expect(await target.transform(dto, { type: "body", metatype: LoginUserDto })).toEqual(dto);
    });

    it("should not validate dto with empty email", async () => {
      const dto = pick(userDto, "password");

      await expect(
        target.transform({ ...dto }, { type: "body", metatype: LoginUserDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should not validate dto with empty password", async () => {
      const dto = pick(userDto, "email");

      await expect(
        target.transform({ ...dto }, { type: "body", metatype: LoginUserDto }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
