import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { RemindersService } from "./reminders.service";
import { SyncEventsService } from "../sync/sync-events.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { FcmService } from "../notifications/fcm.service";
import { MetricsService } from "../metrics/metrics.service";

const mockPrisma = {
  reminder: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  goal: { findFirst: jest.fn() },
  task: { findFirst: jest.fn() },
  habit: { findFirst: jest.fn() },
};

const mockSyncEvents = {
  createEvent: jest.fn(),
  broadcastToUser: jest.fn(),
};

const mockAnalytics = {
  track: jest.fn().mockResolvedValue({ id: "e1" }),
  trackBatch: jest.fn().mockResolvedValue({ count: 0 }),
  findEvents: jest.fn().mockResolvedValue([]),
};

const mockFcm = {
  sendToUser: jest.fn().mockResolvedValue(true),
};

const mockMetrics = {
  remindersPushedTotal: {
    labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
  },
};

describe("RemindersService", () => {
  let service: RemindersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: SyncEventsService, useValue: mockSyncEvents },
        { provide: AnalyticsService, useValue: mockAnalytics },
        { provide: FcmService, useValue: mockFcm },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a reminder for a goal", async () => {
      mockPrisma.goal.findFirst.mockResolvedValue({ id: "g1" });
      mockPrisma.reminder.create.mockResolvedValue({ id: "r1" });

      const result = await service.create("u1", {
        targetType: "goal",
        targetId: "g1",
        triggerAt: "2026-08-11T14:00:00.000Z",
      });

      expect(result.id).toEqual("r1");
      expect(mockPrisma.reminder.create).toHaveBeenCalled();
    });
  });

  describe("upcoming", () => {
    it("should return pending reminders", async () => {
      mockPrisma.reminder.findMany.mockResolvedValue([{ id: "r1" }]);

      const result = await service.upcoming("u1");

      expect(result).toHaveLength(1);
      expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "u1",
            status: "pending",
          }),
        }),
      );
    });
  });

  describe("processDueReminders", () => {
    it("should mark due reminders as sent and broadcast", async () => {
      const past = new Date(Date.now() - 60_000);
      mockPrisma.reminder.findMany.mockResolvedValue([
        {
          id: "r1",
          userId: "u1",
          targetType: "task",
          targetId: "t1",
          triggerAt: past,
          channel: "push",
          snoozeCount: 0,
        },
      ]);
      mockPrisma.reminder.update.mockResolvedValue({ id: "r1" });

      const result = await service.processDueReminders();

      expect(result.processed).toEqual(1);
      expect(mockPrisma.reminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "r1" },
          data: expect.objectContaining({ status: "sent", snoozeCount: 0 }),
        }),
      );
      expect(mockSyncEvents.broadcastToUser).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ eventType: "reminder.triggered" }),
      );
    });
  });

  describe("dismiss", () => {
    it("should mark reminder as dismissed", async () => {
      mockPrisma.reminder.findFirst.mockResolvedValue({ id: "r1" });
      mockPrisma.reminder.update.mockResolvedValue({
        id: "r1",
        status: "dismissed",
      });

      const result = await service.dismiss("u1", "r1");

      expect(result.status).toEqual("dismissed");
    });
  });

  describe("snooze", () => {
    it("should postpone reminder by 15 minutes", async () => {
      const triggerAt = new Date("2026-08-11T14:00:00.000Z");
      mockPrisma.reminder.findFirst.mockResolvedValue({ id: "r1", triggerAt });
      mockPrisma.reminder.update.mockResolvedValue({
        id: "r1",
        triggerAt: new Date(triggerAt.getTime() + 15 * 60 * 1000),
      });

      await service.snooze("u1", "r1", 15);

      expect(mockPrisma.reminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "pending",
            snoozeCount: { increment: 1 },
          }),
        }),
      );
    });

    it("should reject invalid snooze minutes", async () => {
      mockPrisma.reminder.findFirst.mockResolvedValue({ id: "r1" });

      await expect(service.snooze("u1", "r1", 10)).rejects.toThrow();
    });
  });
});
