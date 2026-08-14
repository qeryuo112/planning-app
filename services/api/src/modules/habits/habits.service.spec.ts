import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { HabitsService } from "./habits.service";
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
  habit: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  goal: {
    findMany: jest.fn(),
  },
  checkin: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe("HabitsService", () => {
  let service: HabitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HabitsService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: SyncEventsService, useValue: mockSyncEvents },
        { provide: AnalyticsService, useValue: mockAnalytics },
      ],
    }).compile();

    service = module.get<HabitsService>(HabitsService);
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a habit linked to goals", async () => {
      mockPrisma.goal.findMany.mockResolvedValue([{ id: "g1" }]);
      mockPrisma.habit.create.mockResolvedValue({ id: "h1", title: "习惯" });

      const result = await service.create("u1", {
        title: "习惯",
        frequency: "daily",
        goalIds: ["g1"],
      });

      expect(result.id).toEqual("h1");
      expect(mockPrisma.habit.create).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return user habits", async () => {
      mockPrisma.habit.findMany.mockResolvedValue([{ id: "h1" }]);

      const result = await service.findAll("u1");

      expect(result).toHaveLength(1);
      expect(mockPrisma.habit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "u1" } }),
      );
    });
  });

  describe("stats", () => {
    it("should return habit heatmap and streak stats", async () => {
      mockPrisma.habit.findFirst.mockResolvedValue({ id: "h1" });
      mockPrisma.checkin.findMany.mockResolvedValue([
        {
          id: "c1",
          habitId: "h1",
          date: new Date("2026-08-11T00:00:00.000Z"),
          result: "completed",
        },
        {
          id: "c2",
          habitId: "h1",
          date: new Date("2026-08-12T00:00:00.000Z"),
          result: "completed",
        },
      ]);

      const result = await service.stats("u1", "h1", 3);

      expect(result.habitId).toEqual("h1");
      expect(result.heatmap).toHaveLength(3);
      expect(
        result.heatmap.every((h: { status: string }) =>
          ["done", "skipped", "none"].includes(h.status),
        ),
      ).toBe(true);
      expect(result.completionRate).toBeGreaterThanOrEqual(0);
      expect(result.currentStreak).toBeGreaterThanOrEqual(0);
    });
  });
});
