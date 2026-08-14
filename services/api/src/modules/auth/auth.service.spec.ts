import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn(() => "token"),
  verify: jest.fn(),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should create user and return tokens", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "u1",
        email: "test@example.com",
      });

      const result = await service.register({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.user.email).toEqual("test@example.com");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it("should throw if email already exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });

      await expect(
        service.register({
          email: "test@example.com",
          password: "password123",
        }),
      ).rejects.toThrow("该邮箱已被注册");
    });
  });

  describe("login", () => {
    it("should return tokens for valid credentials", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "test@example.com",
        passwordHash: await bcrypt.hash("password123", 10),
      });

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.user.email).toEqual("test@example.com");
      expect(result.accessToken).toBeDefined();
    });

    it("should throw for invalid credentials", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "test@example.com", password: "password123" }),
      ).rejects.toThrow("邮箱或密码错误");
    });
  });

  describe("refresh", () => {
    it("should rotate tokens for valid refresh token", async () => {
      mockJwtService.verify.mockReturnValue({
        sub: "u1",
        email: "test@example.com",
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        refreshToken: await bcrypt.hash("refresh-token", 10),
      });

      const result = await service.refresh({ refreshToken: "refresh-token" });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });
});
