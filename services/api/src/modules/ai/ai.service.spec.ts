import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { AiService } from "./ai.service";
import { ModelAdapter } from "./model-adapter.service";
import { PlanOrchestrator } from "./plan-orchestrator.service";
import { PlanExecutor } from "./plan-executor.service";
import { SyncEventsService } from "../sync/sync-events.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { AiSessionService } from "./ai-session.service";

const mockPrisma = {
  user: {
    findUnique: jest.fn().mockResolvedValue({
      timezone: "Asia/Shanghai",
      availableTime: {},
      energyCurve: {},
    }),
  },
  planVersion: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  aIOperation: {
    create: jest.fn().mockResolvedValue({ id: "op1" }),
    aggregate: jest.fn().mockResolvedValue({ _sum: { cost: 0 } }),
    count: jest.fn().mockResolvedValue(0),
  },
  review: {
    create: jest.fn().mockResolvedValue({ id: "r1" }),
  },
  goal: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockOrchestrator = {
  generateDraft: jest.fn(),
  advanceStage: jest.fn(),
  buildFallbackDraft: jest.fn().mockReturnValue({
    goal: { title: "目标", horizon: "short" },
    planDuration: 7,
    stageLength: 7,
    currentStage: 1,
    totalStages: 1,
    stages: [],
    milestones: [],
    tasks: [],
    habits: [],
    assumptions: [],
    warnings: [],
    estimatedWeeklyLoad: { totalMinutes: 0, highEnergyMinutes: 0 },
  }),
  buildPlaceholderReview: jest.fn().mockReturnValue({
    summary: "占位复盘",
    insights: ["继续加油"],
    nextActions: ["继续执行"],
  }),
  generateReview: jest.fn(),
  generateReplan: jest.fn(),
  generateDraftStream: jest.fn(),
  buildTemplateFallbackDraft: jest.fn().mockReturnValue({
    goal: { title: "模板目标", horizon: "short" },
    planDuration: 7,
    stageLength: 7,
    currentStage: 1,
    totalStages: 1,
    stages: [],
    milestones: [],
    tasks: [],
    habits: [],
    assumptions: [],
    warnings: [],
    estimatedWeeklyLoad: { totalMinutes: 0, highEnergyMinutes: 0 },
  }),
  getPlaceholderDraft: jest.fn().mockReturnValue({
    goal: { title: "目标", horizon: "short" },
    planDuration: 7,
    stageLength: 7,
    currentStage: 1,
    totalStages: 1,
    stages: [],
    milestones: [],
    tasks: [],
    habits: [],
    assumptions: [],
    warnings: [],
    estimatedWeeklyLoad: { totalMinutes: 0, highEnergyMinutes: 0 },
  }),
};

const mockExecutor = {
  executeDraft: jest.fn().mockResolvedValue({ goalId: "g1", projectId: "p1" }),
};

const mockModelAdapter = {
  getConfig: jest.fn().mockReturnValue({
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "sk-test",
    baseURL: undefined,
    enabled: true,
  }),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue(""),
};

const mockSyncEventsService = {
  createEvent: jest.fn().mockResolvedValue({}),
};

const mockAiSession = {
  getOrCreateSession: jest.fn().mockResolvedValue({ id: "s1" }),
  getSession: jest.fn().mockResolvedValue({ id: "s1" }),
  getMessages: jest.fn().mockResolvedValue([]),
  addMessage: jest.fn().mockResolvedValue({}),
  addMessages: jest.fn().mockResolvedValue([]),
  toChatMessages: jest.fn().mockReturnValue([]),
  maybeSummarize: jest.fn(),
};

const mockAnalytics = {
  track: jest.fn().mockResolvedValue({ id: "e1" }),
  trackBatch: jest.fn().mockResolvedValue({ count: 0 }),
  findEvents: jest.fn().mockResolvedValue([]),
};

describe("AiService", () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: ModelAdapter, useValue: mockModelAdapter },
        { provide: PlanOrchestrator, useValue: mockOrchestrator },
        { provide: PlanExecutor, useValue: mockExecutor },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SyncEventsService, useValue: mockSyncEventsService },
        { provide: AnalyticsService, useValue: mockAnalytics },
        { provide: AiSessionService, useValue: mockAiSession },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  describe("createDraft", () => {
    it("should create a plan version with ai output and stage metadata", async () => {
      mockOrchestrator.generateDraft.mockResolvedValue({
        draft: {
          goal: { title: "学英语", horizon: "short" },
          planDuration: 30,
          stageLength: 7,
          currentStage: 1,
          totalStages: 5,
          stages: [],
          milestones: [],
          tasks: [],
          habits: [],
          assumptions: [],
          warnings: [],
          estimatedWeeklyLoad: { totalMinutes: 0, highEnergyMinutes: 0 },
        },
        fallback: false,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      mockPrisma.planVersion.findFirst.mockResolvedValue(null);
      mockPrisma.planVersion.create.mockResolvedValue({ id: "pv1" });

      const result = await service.createDraft("u1", {
        userInput: "我想学英语",
        planDuration: 30,
        stageLength: 7,
        currentStage: 1,
      });

      expect(result.draftId).toEqual("pv1");
      expect(result.fallback).toEqual(false);
      expect(mockOrchestrator.generateDraft.mock.calls[0]).toEqual([
        "我想学英语",
        expect.objectContaining({
          planDuration: 30,
          stageLength: 7,
          currentStage: 1,
        }),
        undefined,
        expect.any(String),
        [],
      ]);
      expect(mockPrisma.planVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planDuration: 30,
            stageLength: 7,
            currentStage: 1,
            totalStages: 5,
          }),
        }),
      );
      expect(mockPrisma.aIOperation.create).toHaveBeenCalled();
    });

    it("should fallback when model returns error", async () => {
      mockOrchestrator.generateDraft.mockResolvedValue({
        draft: {
          goal: { title: "目标", horizon: "short" },
          planDuration: 7,
          stageLength: 7,
          currentStage: 1,
          totalStages: 1,
          stages: [],
          milestones: [],
          tasks: [],
          habits: [],
          assumptions: [],
          warnings: [],
          estimatedWeeklyLoad: { totalMinutes: 0, highEnergyMinutes: 0 },
        },
        fallback: true,
        error: "模型调用失败",
      });
      mockPrisma.planVersion.findFirst.mockResolvedValue(null);
      mockPrisma.planVersion.create.mockResolvedValue({ id: "pv1" });

      const result = await service.createDraft("u1", {
        userInput: "我想学英语",
      });

      expect(result.draftId).toEqual("pv1");
      expect(result.fallback).toEqual(true);
    });

    it("should use template when templateId is provided", async () => {
      mockOrchestrator.generateDraft.mockResolvedValue({
        draft: {
          goal: { title: "考研英语", horizon: "short" },
          planDuration: 30,
          stageLength: 7,
          currentStage: 1,
          totalStages: 5,
          stages: [],
          milestones: [],
          tasks: [],
          habits: [],
          assumptions: [],
          warnings: [],
          estimatedWeeklyLoad: { totalMinutes: 0, highEnergyMinutes: 0 },
        },
        fallback: false,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      mockPrisma.planVersion.findFirst.mockResolvedValue(null);
      mockPrisma.planVersion.create.mockResolvedValue({ id: "pv1" });

      const result = await service.createDraft("u1", {
        userInput: "我要考研究生英语",
        templateId: "postgraduate-english",
        planDuration: 30,
        stageLength: 7,
        currentStage: 1,
      });

      expect(result.draftId).toEqual("pv1");
      expect(result.fallback).toEqual(false);
      expect(mockOrchestrator.generateDraft.mock.calls[0][2]).toEqual(
        expect.objectContaining({
          id: "postgraduate-english",
          name: "考研英语",
        }),
      );
      expect(mockOrchestrator.generateDraft.mock.calls[0][3]).toEqual(
        expect.any(String),
      );
    });

    it("should fallback to template when daily cost limit is exceeded", async () => {
      mockPrisma.aIOperation.aggregate.mockResolvedValue({
        _sum: { cost: 0.999 },
      });
      mockPrisma.planVersion.findFirst.mockResolvedValue(null);
      mockPrisma.planVersion.create.mockResolvedValue({ id: "pv1" });

      const result = await service.createDraft("u1", {
        userInput: "我要考研英语",
        templateId: "postgraduate-english",
        planDuration: 30,
        stageLength: 7,
        currentStage: 1,
      });

      expect(result.fallback).toEqual(true);
      expect(mockOrchestrator.buildTemplateFallbackDraft).toHaveBeenCalled();
      expect(mockPrisma.planVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: "template" }),
        }),
      );
    });

    it("should fallback to placeholder when cost limit exceeded and no template", async () => {
      mockPrisma.aIOperation.aggregate.mockResolvedValue({
        _sum: { cost: 0.999 },
      });
      mockPrisma.planVersion.findFirst.mockResolvedValue(null);
      mockPrisma.planVersion.create.mockResolvedValue({ id: "pv1" });

      const result = await service.createDraft("u1", {
        userInput: "我想学一门新技能",
        planDuration: 30,
        stageLength: 7,
        currentStage: 1,
      });

      expect(result.fallback).toEqual(true);
      expect(mockOrchestrator.buildFallbackDraft).toHaveBeenCalled();
      expect(
        mockOrchestrator.buildTemplateFallbackDraft,
      ).not.toHaveBeenCalled();
    });
  });

  describe("template helpers", () => {
    it("should list all templates", () => {
      const templates = service.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty("id");
      expect(templates[0]).toHaveProperty("name");
      expect(templates[0]).toHaveProperty("category");
    });

    it("should recommend a template based on input", async () => {
      mockPrisma.goal.findMany.mockResolvedValue([
        { title: "减脂打卡", status: "active" },
      ]);
      const recommendation =
        await service.getTemplateRecommendation("我想减脂");
      expect(recommendation?.id).toEqual("fat-loss");
    });
  });

  describe("usage", () => {
    it("should return daily AI usage summary", async () => {
      mockPrisma.aIOperation.aggregate.mockResolvedValue({
        _sum: { cost: 0.0123 },
      });
      mockPrisma.aIOperation.count.mockResolvedValue(5);

      const usage = await service.getUsage("u1");

      expect(usage.dailyCost).toEqual(0.0123);
      expect(usage.dailyLimit).toEqual(1.0);
      expect(usage.callCount).toEqual(5);
      expect(usage.currency).toEqual("USD");
    });
  });

  describe("advanceDraft", () => {
    it("should create next stage plan version", async () => {
      mockPrisma.planVersion.findFirst
        .mockResolvedValueOnce({
          id: "pv1",
          goalId: "g1",
          payload: {
            goal: { title: "学英语" },
            planDuration: 30,
            stageLength: 7,
            currentStage: 1,
            totalStages: 5,
          },
        })
        .mockResolvedValueOnce({ versionNo: 1 });
      mockOrchestrator.advanceStage.mockResolvedValue({
        draft: {
          goal: { title: "学英语" },
          planDuration: 30,
          stageLength: 7,
          currentStage: 2,
          totalStages: 5,
        },
        fallback: false,
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      });
      mockPrisma.planVersion.create.mockResolvedValue({ id: "pv2" });

      const result = await service.advanceDraft("u1", "pv1");

      expect(result.draftId).toEqual("pv2");
      expect(result.fallback).toEqual(false);
      expect(mockOrchestrator.advanceStage.mock.calls[0]).toEqual([
        "学英语",
        expect.objectContaining({ currentStage: 1 }),
        expect.objectContaining({ currentStage: 2 }),
        expect.any(String),
      ]);
      expect(mockPrisma.planVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            goalId: "g1",
            versionNo: 2,
            currentStage: 2,
          }),
        }),
      );
    });

    it("should return no_advance when reaching last stage", async () => {
      mockPrisma.planVersion.findFirst.mockResolvedValue({
        id: "pv1",
        goalId: "g1",
        payload: {
          goal: { title: "学英语" },
          planDuration: 7,
          stageLength: 7,
          currentStage: 1,
          totalStages: 1,
        },
      });

      const result = await service.advanceDraft("u1", "pv1");

      expect(result.status).toEqual("no_advance");
      expect(mockOrchestrator.advanceStage).not.toHaveBeenCalled();
    });
  });

  describe("approveDraft", () => {
    it("should execute draft and update goalId when confirmed", async () => {
      mockPrisma.planVersion.findFirst.mockResolvedValue({
        id: "pv1",
        goalId: null,
        payload: { goal: { title: "目标" } },
        approvedAt: null,
      });

      const result = await service.approveDraft("u1", "pv1", {
        confirmed: true,
      });

      expect(result.approved).toEqual(true);
      expect(mockExecutor.executeDraft).toHaveBeenCalled();
      expect(mockPrisma.planVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ goalId: "g1" }),
        }),
      );
    });
  });

  describe("review", () => {
    it("should return AI review for existing goal", async () => {
      mockPrisma.goal.findFirst.mockResolvedValue({
        id: "g1",
        title: "学英语",
        milestones: [
          { tasks: [{ status: "done", updatedAt: new Date(), checkins: [] }] },
        ],
        goalLinks: [{ habit: { checkins: [{ date: new Date() }] } }],
      });
      mockOrchestrator.generateReview.mockResolvedValue({
        summary: "本周完成情况良好",
        insights: ["每天坚持背单词"],
        nextActions: ["下周继续"],
        fallback: false,
      });

      const result = await service.review("u1", {
        goalId: "g1",
        period: "weekly" as any,
      });

      expect(result.summary).toContain("完成");
      expect(result.insights).toContain("每天坚持背单词");
      expect(mockPrisma.review.create).toHaveBeenCalled();
      expect(mockOrchestrator.generateReview).toHaveBeenCalled();
    });
  });

  describe("replan", () => {
    it("should create a new plan version based on latest version", async () => {
      mockPrisma.goal.findFirst.mockResolvedValue({
        id: "g1",
        title: "学英语",
        milestones: [{ tasks: [{ status: "done" }, { status: "todo" }] }],
        planVersions: [
          {
            id: "pv1",
            versionNo: 1,
            payload: {
              goal: { title: "学英语" },
              planDuration: 30,
              stageLength: 7,
              currentStage: 1,
              totalStages: 5,
            },
          },
        ],
      });
      mockOrchestrator.generateReplan.mockResolvedValue({
        draft: {
          goal: { title: "学英语" },
          planDuration: 30,
          stageLength: 7,
          currentStage: 2,
          totalStages: 5,
          stages: [],
          milestones: [],
          tasks: [],
          habits: [],
          assumptions: [],
          warnings: [],
          estimatedWeeklyLoad: { totalMinutes: 0, highEnergyMinutes: 0 },
        },
        fallback: false,
      });

      const result = await service.replan("u1", { goalId: "g1" });

      expect(result.draftId).toEqual("pv2");
      expect(result.plan.currentStage).toEqual(2);
      expect(mockPrisma.planVersion.create).toHaveBeenCalled();
      expect(mockOrchestrator.generateReplan).toHaveBeenCalled();
    });
  });

  describe("streamDraft", () => {
    async function collectEvents(
      observable: ReturnType<typeof service.streamDraft>,
    ) {
      const events: Array<{ type: string; [key: string]: any }> = [];
      await new Promise<void>((resolve, reject) => {
        observable.subscribe({
          next: (payload) => {
            try {
              events.push(JSON.parse(payload.data));
            } catch {
              events.push({ type: "parse_error", raw: payload.data });
            }
          },
          error: reject,
          complete: resolve,
        });
      });
      return events;
    }

    it("should emit progress, draft and done events", async () => {
      mockPrisma.planVersion.findFirst.mockResolvedValue({
        id: "pv1",
        goalId: null,
        planDuration: 30,
        stageLength: 7,
        currentStage: 1,
        payload: { status: "pending" },
        userFeedback: {
          context: {
            userInput: "我想学英语",
            templateId: "postgraduate-english",
            constraints: {},
          },
          templateId: "postgraduate-english",
        },
        goal: null,
      });
      mockPrisma.planVersion.update.mockResolvedValue({ id: "pv1" });

      async function* mockStream(): AsyncGenerator<
        import("./plan-orchestrator.service").DraftStreamEvent
      > {
        yield {
          type: "progress",
          stage: "analyzing_input",
          message: "正在分析你的目标…",
        };
        yield {
          type: "result",
          draft: {
            goal: { title: "学英语", horizon: "short" },
            planDuration: 30,
            stageLength: 7,
            currentStage: 1,
            totalStages: 5,
            stages: [],
            milestones: [],
            tasks: [],
            habits: [],
            assumptions: [],
            warnings: [],
            estimatedWeeklyLoad: { totalMinutes: 0, highEnergyMinutes: 0 },
          },
          fallback: false,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };
      }
      mockOrchestrator.generateDraftStream.mockReturnValue(mockStream());

      const observable = service.streamDraft("u1", "pv1");
      const events = await collectEvents(observable);

      const progressEvents = events.filter((e) => e.type === "progress");
      const draftEvent = events.find((e) => e.type === "draft");
      const doneEvent = events.find((e) => e.type === "done");

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(draftEvent).toBeDefined();
      expect(draftEvent.plan).toBeDefined();
      expect(doneEvent).toBeDefined();
      expect(mockPrisma.planVersion.update).toHaveBeenCalled();
      expect(mockPrisma.aIOperation.create).toHaveBeenCalled();
    });

    it("should emit fallback draft when daily cost limit is exceeded", async () => {
      mockPrisma.aIOperation.aggregate.mockResolvedValue({
        _sum: { cost: 0.999 },
      });
      mockPrisma.planVersion.findFirst.mockResolvedValue({
        id: "pv1",
        goalId: null,
        planDuration: 30,
        stageLength: 7,
        currentStage: 1,
        payload: { status: "pending" },
        userFeedback: {
          context: {
            userInput: "我想学英语",
            templateId: "postgraduate-english",
            constraints: {},
          },
        },
        goal: null,
      });
      mockPrisma.planVersion.update.mockResolvedValue({ id: "pv1" });

      const observable = service.streamDraft("u1", "pv1");
      const events = await collectEvents(observable);

      const costLimitEvent = events.find(
        (e) => e.type === "progress" && e.stage === "cost_limit_exceeded",
      );
      const draftEvent = events.find((e) => e.type === "draft");

      expect(costLimitEvent).toBeDefined();
      expect(draftEvent).toBeDefined();
      expect(draftEvent.fallback).toEqual(true);
    });

    it("should emit error when plan version not found", async () => {
      mockPrisma.planVersion.findFirst.mockResolvedValue(null);

      const observable = service.streamDraft("u1", "missing");
      const events = await collectEvents(observable);

      expect(events.some((e) => e.type === "error")).toEqual(true);
    });
  });
});
