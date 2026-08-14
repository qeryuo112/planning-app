import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { AiInsightsService } from "./ai-insights.service";
import { ModelAdapter } from "./model-adapter.service";

const mockPrisma = {
  task: {
    findMany: jest.fn(),
  },
  habit: {
    count: jest.fn(),
  },
  checkin: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  goal: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  aIOperation: {
    aggregate: jest.fn(),
    create: jest.fn(),
  },
  userProfileSnapshot: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

const mockModelAdapter = {
  getConfig: jest
    .fn()
    .mockReturnValue({ model: "deepseek-reasoner", apiKey: "" }),
  generateStructured: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === "AI_DAILY_COST_LIMIT_USD") return "1.0";
    if (key === "AI_STRONG_MODEL") return "deepseek-reasoner";
    return undefined;
  }),
};

describe("AiInsightsService", () => {
  let service: AiInsightsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiInsightsService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: ModelAdapter, useValue: mockModelAdapter },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiInsightsService>(AiInsightsService);
    jest.clearAllMocks();
  });

  describe("getProfileSummary", () => {
    it("should return fallback summary when AI not configured", async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { status: "done", energyLevel: "high" },
        { status: "todo", energyLevel: "medium" },
      ]);
      mockPrisma.habit.count.mockResolvedValue(1);
      mockPrisma.checkin.findMany.mockResolvedValue([
        { result: "completed", blockReasonTag: null, createdAt: new Date() },
      ]);
      mockPrisma.goal.findMany.mockResolvedValue([{ status: "active" }]);
      mockPrisma.aIOperation.aggregate.mockResolvedValue({ _sum: { cost: 0 } });

      const result = await service.getProfileSummary("u1");

      expect(result.fallback).toBeTruthy();
      expect(result.stats.completionRate).toEqual(50);
      expect(result.summary).toContain("完成率 50%");
    });

    it("should use model output when configured", async () => {
      mockModelAdapter.getConfig.mockReturnValue({
        model: "deepseek-reasoner",
        apiKey: "sk-test",
      });
      mockModelAdapter.generateStructured.mockResolvedValue({
        data: {
          summary: "执行力强",
          strengths: ["坚持打卡"],
          weaknesses: ["容易推迟"],
          suggestedFocus: "减少并行任务",
          riskAreas: ["任务堆积"],
        },
        raw: "",
        model: "deepseek-reasoner",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.habit.count.mockResolvedValue(0);
      mockPrisma.checkin.findMany.mockResolvedValue([]);
      mockPrisma.goal.findMany.mockResolvedValue([]);
      mockPrisma.aIOperation.aggregate.mockResolvedValue({ _sum: { cost: 0 } });
      mockPrisma.aIOperation.create.mockResolvedValue({ id: "op1" });

      const result = await service.getProfileSummary("u1");

      expect(result.fallback).toBeFalsy();
      expect(result.summary).toEqual("执行力强");
      expect(mockPrisma.aIOperation.create).toHaveBeenCalled();
    });
  });

  describe("getPersonalizedRecommendations", () => {
    it("should recommend based on stats", async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { status: "done", energyLevel: "high" },
        { status: "done", energyLevel: "high" },
        { status: "todo", energyLevel: "medium" },
      ]);
      mockPrisma.habit.count.mockResolvedValue(1);
      mockPrisma.checkin.findMany.mockResolvedValue([
        { result: "completed", blockReasonTag: null, createdAt: new Date() },
      ]);
      mockPrisma.goal.findMany.mockResolvedValue([{ status: "active" }]);

      const result = await service.getPersonalizedRecommendations("u1");

      expect(result.recommendations.scheduleTips.length).toBeGreaterThan(0);
      expect(result.stats.completionRate).toEqual(67);
    });
  });

  describe("profile snapshot", () => {
    it("should return latest snapshot when useSnapshot is true", async () => {
      mockPrisma.userProfileSnapshot.findFirst.mockResolvedValue({
        id: "snap1",
        userId: "u1",
        summary: {
          summary: "从快照读取",
          strengths: [],
          weaknesses: [],
          suggestedFocus: "",
          riskAreas: [],
        },
        stats: {
          totalTasks: 10,
          doneTasks: 5,
          skippedTasks: 0,
          postponedTasks: 0,
          completionRate: 50,
          totalHabits: 0,
          totalCheckins: 0,
          completedCheckins: 0,
          checkinRate: 0,
          activeGoals: 0,
          completedGoals: 0,
          topPostponeReasons: [],
          topEnergyLevel: null,
          recentActivityDays: 0,
        },
        fallback: false,
        error: null,
        refreshedAt: new Date("2026-08-01T00:00:00Z"),
      });

      const result = await service.getProfileSummary("u1", true);

      expect(result.summary).toEqual("从快照读取");
      expect((result as any).refreshedAt).toEqual("2026-08-01T00:00:00.000Z");
      expect(mockModelAdapter.generateStructured).not.toHaveBeenCalled();
    });

    it("should save snapshot after successful real-time generation", async () => {
      mockPrisma.userProfileSnapshot.findFirst.mockResolvedValue(null);
      mockModelAdapter.getConfig.mockReturnValue({
        model: "deepseek-reasoner",
        apiKey: "sk-test",
      });
      mockModelAdapter.generateStructured.mockResolvedValue({
        data: {
          summary: "执行力强",
          strengths: ["坚持打卡"],
          weaknesses: ["容易推迟"],
          suggestedFocus: "减少并行任务",
          riskAreas: ["任务堆积"],
        },
        raw: "",
        model: "deepseek-reasoner",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.habit.count.mockResolvedValue(0);
      mockPrisma.checkin.findMany.mockResolvedValue([]);
      mockPrisma.goal.findMany.mockResolvedValue([]);
      mockPrisma.aIOperation.aggregate.mockResolvedValue({ _sum: { cost: 0 } });
      mockPrisma.aIOperation.create.mockResolvedValue({ id: "op1" });
      mockPrisma.userProfileSnapshot.create.mockResolvedValue({ id: "snap1" });

      await service.getProfileSummary("u1");

      expect(mockPrisma.userProfileSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "u1",
            fallback: false,
          }),
        }),
      );
    });

    it("should refresh and save profile snapshot", async () => {
      mockModelAdapter.getConfig.mockReturnValue({
        model: "deepseek-reasoner",
        apiKey: "sk-test",
      });
      mockModelAdapter.generateStructured.mockResolvedValue({
        data: {
          summary: "刷新后的摘要",
          strengths: [],
          weaknesses: [],
          suggestedFocus: "",
          riskAreas: [],
        },
        raw: "",
        model: "deepseek-reasoner",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.habit.count.mockResolvedValue(0);
      mockPrisma.checkin.findMany.mockResolvedValue([]);
      mockPrisma.goal.findMany.mockResolvedValue([]);
      mockPrisma.aIOperation.aggregate.mockResolvedValue({ _sum: { cost: 0 } });
      mockPrisma.aIOperation.create.mockResolvedValue({ id: "op1" });
      mockPrisma.userProfileSnapshot.create.mockResolvedValue({ id: "snap2" });

      const result = await service.refreshProfileSnapshot("u1");

      expect(result.summary).toEqual("刷新后的摘要");
      expect(mockPrisma.userProfileSnapshot.create).toHaveBeenCalled();
    });

    it("should refresh snapshots for all active users via cron", async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
      mockModelAdapter.getConfig.mockReturnValue({
        model: "deepseek-reasoner",
        apiKey: "sk-test",
      });
      mockModelAdapter.generateStructured.mockResolvedValue({
        data: {
          summary: "cron 摘要",
          strengths: [],
          weaknesses: [],
          suggestedFocus: "",
          riskAreas: [],
        },
        raw: "",
        model: "deepseek-reasoner",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.habit.count.mockResolvedValue(0);
      mockPrisma.checkin.findMany.mockResolvedValue([]);
      mockPrisma.goal.findMany.mockResolvedValue([]);
      mockPrisma.aIOperation.aggregate.mockResolvedValue({ _sum: { cost: 0 } });
      mockPrisma.aIOperation.create.mockResolvedValue({ id: "op1" });
      mockPrisma.userProfileSnapshot.create.mockResolvedValue({ id: "snap" });

      await service.autoRefreshProfiles();

      expect(mockPrisma.user.findMany).toHaveBeenCalled();
      expect(mockPrisma.userProfileSnapshot.create).toHaveBeenCalledTimes(2);
    });
  });
});
