import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { GoalsService } from "./goals.service";
import { SyncEventsService } from "../sync/sync-events.service";
import { AnalyticsService } from "../analytics/analytics.service";

const mockSyncEvents = {
  createEvent: jest.fn().mockResolvedValue({ id: "e1" }),
};

const mockAnalytics = {
  track: jest.fn().mockResolvedValue({ id: "e1" }),
  trackBatch: jest.fn().mockResolvedValue({ count: 0 }),
  findEvents: jest.fn().mockResolvedValue([]),
};

const mockPrisma = {
  goal: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  milestone: {
    update: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

describe("GoalsService", () => {
  let service: GoalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: SyncEventsService, useValue: mockSyncEvents },
        { provide: AnalyticsService, useValue: mockAnalytics },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a goal with milestones", async () => {
      mockPrisma.goal.create.mockResolvedValue({ id: "g1", title: "目标" });

      const result = await service.create("u1", {
        title: "目标",
        horizon: "short",
        milestones: [{ title: "里程碑1" }],
      });

      expect(result.id).toEqual("g1");
      expect(mockPrisma.goal.create).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return user goals", async () => {
      mockPrisma.goal.findMany.mockResolvedValue([{ id: "g1", title: "目标" }]);

      const result = await service.findAll("u1");

      expect(result).toHaveLength(1);
      expect(mockPrisma.goal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "u1" } }),
      );
    });
  });

  describe("recalculate", () => {
    it("should calculate goal progress based on task weights", async () => {
      mockPrisma.goal.findFirst.mockResolvedValue({
        id: "g1",
        milestones: [
          {
            id: "m1",
            title: "里程碑1",
            weight: 1,
            tasks: [
              { id: "t1", status: "done", weight: 1 },
              { id: "t2", status: "todo", weight: 1 },
            ],
          },
        ],
      });
      mockPrisma.goal.update.mockResolvedValue({ id: "g1" });

      const result = await service.recalculate("u1", "g1");

      expect(result.progress).toEqual(0.5);
      expect(result.milestones[0].progress).toEqual(0.5);
      expect(mockPrisma.milestone.update).toHaveBeenCalled();
    });
  });
});
