import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { ReportsService } from "./reports.service";

const mockPrisma = {
  task: {
    findMany: jest.fn(),
  },
  checkin: {
    findMany: jest.fn(),
  },
  goal: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
};

describe("ReportsService", () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: "REDIS_CLIENT", useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  describe("getExecutionReport", () => {
    it("should summarize weekly tasks and habits", async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { status: "done", energyLevel: "high" },
        { status: "todo", energyLevel: "medium" },
        { status: "skipped", energyLevel: "low" },
      ]);
      mockPrisma.checkin.findMany.mockResolvedValue([
        { result: "completed", habitId: "h1" },
        { result: "completed", habitId: "h1" },
        { result: "skipped", habitId: "h2" },
      ]);
      mockPrisma.goal.findMany.mockResolvedValue([
        { id: "g1", title: "目标1", status: "active" },
      ]);

      const result = await service.getExecutionReport(
        "u1",
        "weekly",
        "2026-08-17",
      );

      expect(result.period).toEqual("weekly");
      expect(result.taskSummary.total).toEqual(3);
      expect(result.taskSummary.done).toEqual(1);
      expect(result.taskSummary.completionRate).toEqual(33);
      expect(result.habitSummary.totalCheckins).toEqual(3);
      expect(result.habitSummary.completionRate).toEqual(67);
      expect(result.goalCount.active).toEqual(1);
    });
  });

  describe("getEnergyAnalysis", () => {
    it("should return energy curve and completion by energy level", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        energyCurve: { "9": "high", "14": "medium" },
      });
      mockPrisma.task.findMany.mockResolvedValue([
        { status: "done", energyLevel: "high" },
        { status: "done", energyLevel: "high" },
        { status: "skipped", energyLevel: "low" },
      ]);
      mockPrisma.checkin.findMany.mockResolvedValue([
        { result: "completed" },
        { result: "skipped" },
      ]);

      const result = await service.getEnergyAnalysis("u1");

      expect(result.energyCurve).toEqual({ "9": "high", "14": "medium" });
      expect(result.completionByEnergy.high).toEqual({
        total: 2,
        done: 2,
        rate: 100,
      });
      expect(result.suggestion).toContain("高");
    });
  });

  describe("getBestTimeReport", () => {
    it("should aggregate completed checkins by hour", async () => {
      const base = new Date();
      base.setDate(base.getDate() - 1);
      mockPrisma.checkin.findMany.mockResolvedValue([
        {
          createdAt: new Date(base.setUTCHours(9, 0, 0, 0)),
          result: "completed",
        },
        {
          createdAt: new Date(base.setUTCHours(9, 30, 0, 0)),
          result: "completed",
        },
        {
          createdAt: new Date(base.setUTCHours(14, 0, 0, 0)),
          result: "completed",
        },
      ]);

      const result = await service.getBestTimeReport("u1");

      expect(result.hourlyCompletion[9].count).toEqual(2);
      expect(result.hourlyCompletion[14].count).toEqual(1);
      expect(result.bestHours).toContain(9);
    });
  });
});
