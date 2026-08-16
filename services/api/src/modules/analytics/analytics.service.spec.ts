import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { AnalyticsService } from "./analytics.service";
import { MetricsService } from "../metrics/metrics.service";

const mockPrisma = {
  userEvent: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockMetrics = {
  analyticsTrackedTotal: {
    labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
    inc: jest.fn(),
  },
};

describe("AnalyticsService", () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  describe("track", () => {
    it("should create a single UserEvent record", async () => {
      mockPrisma.userEvent.create.mockResolvedValue({
        id: "e1",
        userId: "u1",
        eventType: "today.view",
      });

      const result = await service.track({
        userId: "u1",
        eventType: "today.view",
        targetId: "t1",
        metadata: { source: "mobile" },
        clientTimestamp: new Date("2026-08-16T09:00:00.000Z"),
      });

      expect(result.eventType).toEqual("today.view");
      expect(mockPrisma.userEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "u1",
            eventType: "today.view",
            targetId: "t1",
            metadata: { source: "mobile" },
          }),
        }),
      );
      expect(mockMetrics.analyticsTrackedTotal.labels).toHaveBeenCalledWith("today.view");
    });
  });

  describe("trackBatch", () => {
    it("should create multiple UserEvent records", async () => {
      mockPrisma.userEvent.createMany.mockResolvedValue({ count: 2 });

      const result = await service.trackBatch([
        { userId: "u1", eventType: "task.completed", targetId: "t1" },
        { userId: "u1", eventType: "habit.checkin", targetId: "h1" },
      ]);

      expect((result as { count: number }).count).toEqual(2);
      expect(mockPrisma.userEvent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: "u1", eventType: "task.completed", targetId: "t1" }),
            expect.objectContaining({ userId: "u1", eventType: "habit.checkin", targetId: "h1" }),
          ]),
          skipDuplicates: false,
        }),
      );
      expect(mockMetrics.analyticsTrackedTotal.inc).toHaveBeenCalledWith(2);
    });

    it("should return empty array when input is empty", async () => {
      const result = await service.trackBatch([]);
      expect(result).toEqual([]);
      expect(mockPrisma.userEvent.createMany).not.toHaveBeenCalled();
    });
  });

  describe("findEvents", () => {
    it("should query user events with filters", async () => {
      mockPrisma.userEvent.findMany.mockResolvedValue([
        { id: "e1", eventType: "today.view" },
      ]);

      const result = await service.findEvents("u1", {
        eventType: "today.view",
        limit: 10,
        offset: 5,
      });

      expect(result).toHaveLength(1);
      expect(mockPrisma.userEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: "u1",
            eventType: "today.view",
          },
          orderBy: { serverTimestamp: "desc" },
          take: 10,
          skip: 5,
        }),
      );
    });
  });
});
