import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { TasksService } from "./tasks.service";
import { SyncEventsService } from "../sync/sync-events.service";

const mockSyncEvents = {
  createEvent: jest.fn().mockResolvedValue({ id: "e1" }),
};

const mockPrisma = {
  task: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  milestone: {
    findFirst: jest.fn(),
  },
  checkin: {
    create: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

describe("TasksService", () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: SyncEventsService, useValue: mockSyncEvents },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a task with project and milestone", async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: "p1" });
      mockPrisma.milestone.findFirst.mockResolvedValue({ id: "m1" });
      mockPrisma.task.create.mockResolvedValue({ id: "t1", title: "任务" });

      const result = await service.create("u1", {
        title: "任务",
        projectId: "p1",
        milestoneId: "m1",
        scheduledDate: "2026-08-11",
      });

      expect(result.id).toEqual("t1");
      expect(mockPrisma.task.create).toHaveBeenCalled();
    });
  });

  describe("findByDate", () => {
    it("should query tasks by scheduled date", async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: "t1" }]);

      const result = await service.findByDate("u1", "2026-08-11");

      expect(result).toHaveLength(1);
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "u1",
            scheduledDate: {
              gte: new Date("2026-08-11T00:00:00.000Z"),
              lte: new Date("2026-08-11T23:59:59.999Z"),
            },
          }),
        }),
      );
    });
  });

  describe("postpone", () => {
    it("should mark task postponed and create skipped checkin", async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: "t1",
        scheduledDate: new Date("2026-08-11T00:00:00.000Z"),
      });
      mockPrisma.task.update.mockResolvedValue({
        id: "t1",
        status: "postponed",
      });
      mockPrisma.checkin.create.mockResolvedValue({ id: "c1" });

      const result = await service.postpone("u1", "t1", { reason: "时间不够" });

      expect(result.task.status).toEqual("postponed");
      expect(mockPrisma.checkin.create).toHaveBeenCalled();
      expect(mockSyncEvents.createEvent).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ eventType: "task.postponed" }),
      );
    });

    it("should reschedule task to new date", async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: "t1",
        scheduledDate: new Date("2026-08-11T00:00:00.000Z"),
      });
      mockPrisma.task.update.mockResolvedValue({ id: "t1", status: "todo" });
      mockPrisma.checkin.create.mockResolvedValue({ id: "c1" });

      const result = await service.postpone("u1", "t1", {
        newScheduledDate: "2026-08-13",
      });

      expect(result.task.status).toEqual("todo");
    });
  });

  describe("makeup", () => {
    it("should mark task done and create makeup checkin", async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: "t1",
        scheduledDate: new Date("2026-08-11T00:00:00.000Z"),
      });
      mockPrisma.task.update.mockResolvedValue({ id: "t1", status: "done" });
      mockPrisma.checkin.create.mockResolvedValue({ id: "c1", isMakeup: true });

      const result = await service.makeup("u1", "t1", { actualMinutes: 20 });

      expect(result.task.status).toEqual("done");
      expect(result.checkin.isMakeup).toEqual(true);
      expect(mockSyncEvents.createEvent).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ eventType: "task.madeup" }),
      );
    });
  });
});
