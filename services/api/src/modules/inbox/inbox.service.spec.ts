import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { InboxService } from "./inbox.service";
import { ConvertTargetType } from "./dto/convert-inbox-item.dto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SyncEventsService } from "../sync/sync-events.service";

const mockInboxItem = {
  id: "i1",
  userId: "u1",
  title: "待整理",
  description: "描述",
  status: "pending",
  convertedToType: null,
  convertedToId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSyncEventsService = {
  createEvent: jest.fn(),
};

const mockPrisma = {
  inboxItem: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  task: {
    create: jest.fn(),
  },
  goal: {
    create: jest.fn(),
  },
  project: {
    create: jest.fn(),
  },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

describe("InboxService", () => {
  let service: InboxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: SyncEventsService, useValue: mockSyncEventsService },
      ],
    }).compile();

    service = module.get<InboxService>(InboxService);
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create an inbox item", async () => {
      mockPrisma.inboxItem.create.mockResolvedValue(mockInboxItem);

      const result = await service.create("u1", {
        title: "待整理",
        description: "描述",
      });

      expect(result.title).toEqual("待整理");
      expect(mockPrisma.inboxItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "u1", status: "pending" }),
        }),
      );
    });
  });

  describe("findAll", () => {
    it("should return pending items", async () => {
      mockPrisma.inboxItem.findMany.mockResolvedValue([mockInboxItem]);

      const result = await service.findAll("u1");

      expect(result).toHaveLength(1);
      expect(mockPrisma.inboxItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "u1", status: "pending" },
        }),
      );
    });
  });

  describe("update", () => {
    it("should update title and description", async () => {
      mockPrisma.inboxItem.findFirst.mockResolvedValue(mockInboxItem);
      mockPrisma.inboxItem.update.mockResolvedValue({
        ...mockInboxItem,
        title: "新标题",
      });

      const result = await service.update("u1", "i1", {
        title: "新标题",
      });

      expect(result.title).toEqual("新标题");
    });
  });

  describe("dismiss", () => {
    it("should mark item as dismissed", async () => {
      mockPrisma.inboxItem.findFirst.mockResolvedValue(mockInboxItem);
      mockPrisma.inboxItem.update.mockResolvedValue({
        ...mockInboxItem,
        status: "dismissed",
      });

      const result = await service.dismiss("u1", "i1");

      expect(result.status).toEqual("dismissed");
    });
  });

  describe("convert", () => {
    it("should convert to task", async () => {
      mockPrisma.inboxItem.findFirst.mockResolvedValue(mockInboxItem);
      mockPrisma.task.create.mockResolvedValue({ id: "t1" });
      mockPrisma.inboxItem.update.mockResolvedValue({
        ...mockInboxItem,
        status: "converted",
        convertedToType: "task",
        convertedToId: "t1",
      });

      const result = await service.convert("u1", "i1", {
        targetType: ConvertTargetType.TASK,
      });

      expect(result.convertedToType).toEqual("task");
      expect(result.convertedToId).toEqual("t1");
    });

    it("should convert to goal", async () => {
      mockPrisma.inboxItem.findFirst.mockResolvedValue(mockInboxItem);
      mockPrisma.goal.create.mockResolvedValue({ id: "g1" });
      mockPrisma.inboxItem.update.mockResolvedValue({
        ...mockInboxItem,
        status: "converted",
        convertedToType: "goal",
        convertedToId: "g1",
      });

      const result = await service.convert("u1", "i1", {
        targetType: ConvertTargetType.GOAL,
      });

      expect(result.convertedToType).toEqual("goal");
    });

    it("should reject converting non-pending item", async () => {
      mockPrisma.inboxItem.findFirst.mockResolvedValue({
        ...mockInboxItem,
        status: "converted",
      });

      await expect(
        service.convert("u1", "i1", { targetType: ConvertTargetType.TASK }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findOne", () => {
    it("should throw NotFoundException when item missing", async () => {
      mockPrisma.inboxItem.findFirst.mockResolvedValue(null);

      await expect(service.update("u1", "i1", { title: "x" })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
