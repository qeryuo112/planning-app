import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { AiSessionService } from "./ai-session.service";
import { ModelAdapter } from "./model-adapter.service";

const mockPrisma = {
  aISession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  aIMessage: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn(),
};

const mockModelAdapter = {
  getConfig: jest.fn().mockReturnValue({ model: "gpt-4o-mini" }),
  generateStructured: jest.fn(),
};

describe("AiSessionService", () => {
  let service: AiSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSessionService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ModelAdapter, useValue: mockModelAdapter },
      ],
    }).compile();

    service = module.get<AiSessionService>(AiSessionService);
    jest.clearAllMocks();
  });

  describe("getOrCreateSession", () => {
    it("should return existing session if found within 24h", async () => {
      mockPrisma.aISession.findFirst.mockResolvedValue({ id: "s1" });

      const result = await service.getOrCreateSession("u1", "goal", "g1");

      expect(result.id).toEqual("s1");
      expect(mockPrisma.aISession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "u1", contextType: "goal", contextId: "g1" }),
        }),
      );
      expect(mockPrisma.aISession.create).not.toHaveBeenCalled();
    });

    it("should create new session when no existing session", async () => {
      mockPrisma.aISession.findFirst.mockResolvedValue(null);
      mockPrisma.aISession.create.mockResolvedValue({ id: "s2" });

      const result = await service.getOrCreateSession("u1", "general");

      expect(result.id).toEqual("s2");
      expect(mockPrisma.aISession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "u1", contextType: "general", contextId: null }),
        }),
      );
    });
  });

  describe("getSession", () => {
    it("should return session if owned by user", async () => {
      mockPrisma.aISession.findFirst.mockResolvedValue({ id: "s1", userId: "u1" });

      const result = await service.getSession("u1", "s1");

      expect(result.id).toEqual("s1");
    });

    it("should throw NotFoundException when session not found", async () => {
      mockPrisma.aISession.findFirst.mockResolvedValue(null);

      await expect(service.getSession("u1", "s1")).rejects.toThrow("会话不存在");
    });
  });

  describe("addMessages", () => {
    it("should create messages and increment turn count", async () => {
      mockPrisma.aIMessage.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.aIMessage.findMany.mockResolvedValue([
        { id: "m1", role: "user", content: "hello" },
      ]);
      mockPrisma.aISession.update.mockResolvedValue({ id: "s1" });

      const result = await service.addMessages([
        { sessionId: "s1", role: "user", content: "hello" },
        { sessionId: "s1", role: "assistant", content: "hi" },
      ]);

      expect(result).toHaveLength(1);
      expect(mockPrisma.aIMessage.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ sessionId: "s1", role: "user", content: "hello" }),
            expect.objectContaining({ sessionId: "s1", role: "assistant", content: "hi" }),
          ]),
        }),
      );
      expect(mockPrisma.aISession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "s1" },
          data: { turnCount: { increment: 2 } },
        }),
      );
    });
  });

  describe("maybeSummarize", () => {
    it("should not summarize when turn count is below threshold", async () => {
      mockPrisma.aISession.findUnique.mockResolvedValue({ turnCount: 5, summary: null });

      await service.maybeSummarize("s1");

      expect(mockModelAdapter.generateStructured).not.toHaveBeenCalled();
      expect(mockPrisma.aISession.update).not.toHaveBeenCalled();
    });

    it("should not summarize when summary already exists", async () => {
      mockPrisma.aISession.findUnique.mockResolvedValue({ turnCount: 15, summary: "已有摘要" });

      await service.maybeSummarize("s1");

      expect(mockModelAdapter.generateStructured).not.toHaveBeenCalled();
      expect(mockPrisma.aISession.update).not.toHaveBeenCalled();
    });

    it("should generate summary using cheap model when threshold reached", async () => {
      mockPrisma.aISession.findUnique.mockResolvedValue({ turnCount: 12, summary: null });
      mockPrisma.aIMessage.findMany.mockResolvedValue([
        { role: "user", content: "我想学英语", createdAt: new Date() },
        { role: "assistant", content: "已生成计划", createdAt: new Date() },
      ]);
      mockPrisma.aISession.update.mockResolvedValue({ id: "s1" });
      mockConfigService.get.mockReturnValue("deepseek-v4-flash");
      mockModelAdapter.generateStructured.mockResolvedValue({
        data: { summary: "用户想学英语，AI 已生成初步计划" },
      });

      await service.maybeSummarize("s1");

      expect(mockModelAdapter.generateStructured).toHaveBeenCalledWith(
        expect.stringContaining("总结以下 AI 计划教练与用户的多轮对话核心内容"),
        expect.objectContaining({
          type: "object",
          properties: expect.objectContaining({ summary: expect.any(Object) }),
          required: ["summary"],
        }),
        { modelName: "deepseek-v4-flash" },
      );
      expect(mockPrisma.aISession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "s1" },
          data: { summary: "用户想学英语，AI 已生成初步计划" },
        }),
      );
    });

    it("should fall back to default model when AI_CHEAP_MODEL not configured", async () => {
      mockPrisma.aISession.findUnique.mockResolvedValue({ turnCount: 12, summary: null });
      mockPrisma.aIMessage.findMany.mockResolvedValue([]);
      mockConfigService.get.mockReturnValue(undefined);
      mockModelAdapter.generateStructured.mockResolvedValue({
        data: { summary: "无内容" },
      });

      await service.maybeSummarize("s1");

      expect(mockModelAdapter.generateStructured).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { modelName: "gpt-4o-mini" },
      );
    });
  });

  describe("toChatMessages", () => {
    it("should map ai messages to chat completion messages", () => {
      const result = service.toChatMessages([
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ]);

      expect(result).toEqual([
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ]);
    });
  });
});
