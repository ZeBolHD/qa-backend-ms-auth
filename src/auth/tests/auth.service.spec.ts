import { LoggerModule } from "nestjs-pino";
import { omit, pick } from "@common/utils";
import { ConflictException, HttpStatus, UnauthorizedException } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Role } from "@prisma/client";
import { PrismaService } from "@prismadb/prisma.service";

import { UserResponse } from "@user/responses";
import { UserService } from "@user/user.service";
import { AuthService } from "@auth/auth.service";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { MailerService } from "@nestjs-modules/mailer";

import { RegisterUserDto } from "@auth/dto";

import { Response } from "express";

import * as bcrypt from "bcrypt";
import { Tokens } from "@auth/interfaces";
import { LoginResponse } from "@auth/responses";

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe("AuthService", () => {
  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    token: {
      delete: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const userServiceMock = {
    create: jest.fn(),
    checkIsUserExist: jest.fn(),
    findOne: jest.fn(),
    edit: jest.fn(),
    delete: jest.fn(),
  };

  const jwtServiceMock = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const user = {
    id: "test-id",
    email: "email@example.com",
    fullName: "fullName",
    password: "password",
    banned: false,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [Role.USER],
  };

  const responseMock: Partial<Response> = {
    send: jest.fn().mockImplementation((data) => data),
    status: jest.fn().mockImplementation(() => responseMock),
    json: jest.fn().mockImplementation((data) => data),
    cookie: jest.fn().mockImplementation(() => responseMock),
    clearCookie: jest.fn().mockImplementation(() => responseMock),
  };

  const generateTokensSpy = jest.spyOn(AuthService.prototype as any, "generateTokens");

  let authService: AuthService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        LoggerModule.forRoot({}),
      ],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        AuthService,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: userServiceMock,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2020-01-01"));
  });

  it("should be defined", () => {
    expect(authService).toBeDefined();
  });

  describe("register", () => {
    it("should be defined", () => {
      expect(authService.register).toBeDefined();
    });

    it("should register user", async () => {
      const dto = {
        ...omit(user, "id", "createdAt", "updatedAt"),
        passwordRepeat: "password",
      } as RegisterUserDto;

      userServiceMock.create.mockResolvedValue(user);
      userServiceMock.checkIsUserExist.mockResolvedValue(false);

      jest.spyOn(AuthService.prototype as any, "sendConfirmationMail").mockResolvedValue(true);

      expect(await authService.register(dto)).toEqual<Omit<UserResponse, "password" | "updatedAt">>(
        user,
      );

      expect(userServiceMock.create).toHaveBeenCalled();
      expect(userServiceMock.checkIsUserExist).toHaveBeenCalled();
      expect(userServiceMock.delete).not.toHaveBeenCalled();
    });

    it("should not register user if user already exists", async () => {
      const dto = {
        ...omit(user, "id", "createdAt", "updatedAt"),
        passwordRepeat: "password",
      } as RegisterUserDto;

      userServiceMock.checkIsUserExist.mockResolvedValue(true);

      await expect(authService.register(dto)).rejects.toThrow(ConflictException);

      expect(userServiceMock.create).not.toHaveBeenCalled();
      expect(userServiceMock.delete).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("should be defined", () => {
      expect(authService.login).toBeDefined();
    });

    it("should login user", async () => {
      const dto = pick(user, "email", "password");

      userServiceMock.findOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtServiceMock.sign.mockReturnValue("token");
      prismaMock.token.findFirst.mockResolvedValue(null);

      const tokens: Tokens = {
        refreshToken: {
          token: "token",
          expiresIn: new Date(),
          userAgent: "Chrome",
          userId: user.id,
        },
        accessToken: {
          token: "token",
          expiresIn: Date.now() + 3600000,
        },
      };

      generateTokensSpy.mockResolvedValue(tokens);

      expect(await authService.login(dto, "Chrome", responseMock as Response)).resolves;

      expect(responseMock.status).toHaveBeenCalledWith(200);
      expect(responseMock.cookie).toHaveBeenCalled();
      expect(responseMock.send).toHaveBeenCalledWith(
        new LoginResponse(
          omit(user, "password", "updatedAt"),
          tokens.accessToken.token,
          tokens.accessToken.expiresIn,
        ),
      );
    });

    it("should not login user if user not found", async () => {
      const dto = pick(user, "email", "password");

      userServiceMock.findOne.mockResolvedValue(null);

      await expect(authService.login(dto, "Chrome", responseMock as Response)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should not login user if password is incorrect", async () => {
      const dto = pick(user, "email", "password");

      userServiceMock.findOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(dto, "Chrome", responseMock as Response)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(generateTokensSpy).not.toHaveBeenCalled();
    });

    it("should not login user if user is not verified", async () => {
      const dto = pick(user, "email", "password");

      userServiceMock.findOne.mockResolvedValue({ ...user, verified: false });

      await expect(authService.login(dto, "Chrome", responseMock as Response)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(generateTokensSpy).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("should be defined", () => {
      expect(authService.logout).toBeDefined();
    });

    it("should logout user", async () => {
      prismaMock.token.delete.mockResolvedValue({
        userId: user.id,
      });

      expect(await authService.logout(user.id, responseMock as Response)).toEqual(undefined);
      expect(responseMock.send).toHaveBeenCalledWith({ message: "Вы вышли из учётной записи" });
      expect(prismaMock.token.delete).toHaveBeenCalled();
      expect(responseMock.clearCookie).toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(200);
    });

    it("should not logout user if token not exists in cookie", async () => {
      prismaMock.token.delete.mockResolvedValue(null);

      await expect(authService.logout("", responseMock as Response)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should not logout user if token is invalid", async () => {
      prismaMock.token.delete.mockResolvedValue(null);

      await expect(authService.logout("invalid", responseMock as Response)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prismaMock.token.delete).toHaveBeenCalled();
    });
  });

  describe("refreshTokens", () => {
    it("should be defined", () => {
      expect(authService.refreshTokens).toBeDefined();
    });

    it("should refresh tokens", async () => {
      const refreshToken = {
        token: "token",
        expiresIn: new Date(),
        userAgent: "Chrome",
        userId: user.id,
      };

      prismaMock.token.findUnique.mockResolvedValue(refreshToken);
      userServiceMock.findOne.mockResolvedValue(user);

      const tokens: Tokens = {
        refreshToken,
        accessToken: {
          token: "token",
          expiresIn: Date.now() + 3600000,
        },
      };

      generateTokensSpy.mockResolvedValue(tokens);

      expect(await authService.refreshTokens("token", "Chrome", responseMock as Response)).resolves;

      expect(responseMock.cookie).toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(responseMock.send).toHaveBeenCalledWith({
        accessToken: tokens.accessToken.token,
        expiresIn: tokens.accessToken.expiresIn,
      });
    });

    it("should not refresh tokens if refresh token is empty", async () => {
      prismaMock.token.findUnique.mockResolvedValue(null);

      await expect(
        authService.refreshTokens("", "Chrome", responseMock as Response),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.token.upsert).not.toHaveBeenCalled();
      expect(generateTokensSpy).not.toHaveBeenCalled();
      expect(responseMock.cookie).not.toHaveBeenCalled();
    });

    it("should not refresh tokens if refresh token is invalid", async () => {
      prismaMock.token.findUnique.mockResolvedValue(null);

      await expect(
        authService.refreshTokens("invalid", "Chrome", responseMock as Response),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.token.upsert).not.toHaveBeenCalled();
      expect(generateTokensSpy).not.toHaveBeenCalled();
      expect(responseMock.cookie).not.toHaveBeenCalled();
    });
  });
});
