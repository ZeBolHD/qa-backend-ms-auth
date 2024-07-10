import { PinoLogger } from "nestjs-pino";
import { omit } from "@common/utils";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";
import { PrismaService } from "@prismadb/prisma.service";
import { CreateUserDto, EditUserDto } from "@user/dto";
import { UserResponse } from "@user/responses";
import { UserService } from "@user/user.service";

describe("UserService", () => {
  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
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

  let userService: UserService;

  beforeAll(async () => {
    userService = new UserService(
      prismaMock as unknown as PrismaService,
      new ConfigService(),
      new PinoLogger({ exclude: ["*"] }),
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2020-01-01"));
  });

  it("should be defined", () => {
    expect(userService).toBeDefined();
  });

  describe("create", () => {
    it("should be defined", () => {
      expect(userService.create).toBeDefined();
    });

    it("should create user", async () => {
      const dto: CreateUserDto = omit(user, "id", "createdAt", "updatedAt");

      prismaMock.user.create.mockResolvedValue(user);
      prismaMock.user.findUnique.mockRejectedValue(null);

      expect(await userService.create(dto)).toEqual<Omit<UserResponse, "password" | "updatedAt">>(
        user,
      );

      expect(prismaMock.user.create).toHaveBeenCalled();
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });

    it("should not create user if user already exists", async () => {
      const dto: CreateUserDto = omit(user, "id", "createdAt", "updatedAt");

      prismaMock.user.findUnique.mockResolvedValue(user);

      await expect(userService.create(dto)).rejects.toThrow(ConflictException);

      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("should get user", async () => {
      prismaMock.user.findFirst.mockResolvedValue(user);

      expect(await userService.getMe(user.id)).toEqual<
        Omit<UserResponse, "password" | "updatedAt">
      >(user);
    });

    it("should not get user if user not found", async () => {
      prismaMock.user.findUnique.mockRejectedValue(null);

      await expect(userService.getMe(user.id)).rejects.toThrow(NotFoundException);

      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });
  });

  describe("edit", () => {
    it("should be defined", () => {
      expect(userService.edit).toBeDefined();
    });

    it("should update user", async () => {
      const dto: EditUserDto = omit(user, "id", "createdAt", "updatedAt");

      prismaMock.user.update.mockResolvedValue(user);
      prismaMock.user.findUnique.mockResolvedValue(user);

      expect(await userService.edit(user.id, dto)).toEqual<
        Omit<UserResponse, "password" | "updatedAt">
      >(user);

      expect(prismaMock.user.update).toHaveBeenCalled();
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });

    it("should not update user if user not found", async () => {
      const dto: EditUserDto = omit(user, "id", "createdAt", "updatedAt");

      prismaMock.user.findUnique.mockRejectedValue(null);

      await expect(userService.edit(user.id, dto)).rejects.toThrow(NotFoundException);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should be defined", () => {
      expect(userService.delete).toBeDefined();
    });

    it("should delete user", async () => {
      prismaMock.user.delete.mockResolvedValue(user);
      prismaMock.user.findUnique.mockResolvedValue(user);

      expect(await userService.delete(user.id, user)).toEqual<
        Omit<UserResponse, "password" | "updatedAt">
      >(user);

      expect(prismaMock.user.delete).toHaveBeenCalled();
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });

    it("should not delete user if user not found", async () => {
      prismaMock.user.findUnique.mockRejectedValue(null);

      await expect(userService.delete(user.id, user)).rejects.toThrow(NotFoundException);

      expect(prismaMock.user.delete).not.toHaveBeenCalled();
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });
  });
});
