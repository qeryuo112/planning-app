import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { CalendarService } from "./calendar.service";
import { SyncEventsService } from "../sync/sync-events.service";

const mockPrisma = {
  calendarEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  task: {
    findFirst: jest.fn(),
  },
};

const mockSyncEventsService = {
  createEvent: jest.fn(),
};

describe("CalendarService", () => {
  let service: CalendarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: SyncEventsService, useValue: mockSyncEventsService },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create an event with all fields", async () => {
      mockPrisma.task.findFirst.mockResolvedValue({ id: "t1" });
      mockPrisma.calendarEvent.create.mockResolvedValue({
        id: "e1",
        title: "会议",
      });

      const result = await service.create("u1", {
        title: "会议",
        startAt: "2026-08-12T10:00:00.000Z",
        endAt: "2026-08-12T11:00:00.000Z",
        taskId: "t1",
      });

      expect(result.id).toEqual("e1");
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "u1",
            title: "会议",
            taskId: "t1",
          }),
        }),
      );
    });

    it("should reject endAt before startAt", async () => {
      await expect(
        service.create("u1", {
          title: "会议",
          startAt: "2026-08-12T11:00:00.000Z",
          endAt: "2026-08-12T10:00:00.000Z",
        }),
      ).rejects.toThrow("开始时间不能晚于结束时间");
    });
  });

  describe("findByRange", () => {
    it("should query events within range", async () => {
      mockPrisma.calendarEvent.findMany.mockResolvedValue([{ id: "e1" }]);

      const result = await service.findByRange(
        "u1",
        "2026-08-01T00:00:00.000Z",
        "2026-08-31T23:59:59.999Z",
      );

      expect(result).toHaveLength(1);
      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "u1",
            startAt: expect.objectContaining({
              gte: new Date("2026-08-01T00:00:00.000Z"),
            }),
          }),
        }),
      );
    });
  });

  describe("update", () => {
    it("should update event title", async () => {
      mockPrisma.calendarEvent.findFirst.mockResolvedValue({
        id: "e1",
        startAt: new Date("2026-08-12T10:00:00.000Z"),
        endAt: new Date("2026-08-12T11:00:00.000Z"),
      });
      mockPrisma.calendarEvent.update.mockResolvedValue({
        id: "e1",
        title: "新标题",
      });

      const result = await service.update("u1", "e1", { title: "新标题" });

      expect(result.title).toEqual("新标题");
    });
  });

  describe("remove", () => {
    it("should delete event", async () => {
      mockPrisma.calendarEvent.findFirst.mockResolvedValue({ id: "e1" });
      mockPrisma.calendarEvent.delete.mockResolvedValue({ id: "e1" });

      const result = await service.remove("u1", "e1");

      expect(result.id).toEqual("e1");
      expect(mockPrisma.calendarEvent.delete).toHaveBeenCalledWith({
        where: { id: "e1" },
      });
    });
  });

  describe("importIcs", () => {
    it("should import VEVENT from ICS text", async () => {
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: "imported" });

      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        "UID:test-1",
        "DTSTART:20260814T100000Z",
        "DTEND:20260814T110000Z",
        "SUMMARY:测试会议",
        "DESCRIPTION:讨论计划",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      const result = await service.importIcs("u1", ics);

      expect(result.imported).toEqual(1);
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "u1",
            title: "测试会议",
            source: "ics",
          }),
        }),
      );
    });

    it("should skip duplicate events by title and startAt", async () => {
      mockPrisma.calendarEvent.findMany.mockResolvedValue([
        { title: "测试会议", startAt: new Date("2026-08-14T10:00:00.000Z") },
      ]);

      const ics = [
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT",
        "UID:test-1",
        "DTSTART:20260814T100000Z",
        "DTEND:20260814T110000Z",
        "SUMMARY:测试会议",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      const result = await service.importIcs("u1", ics);

      expect(result.imported).toEqual(0);
      expect(mockPrisma.calendarEvent.create).not.toHaveBeenCalled();
    });
  });

  describe("exportIcs", () => {
    it("should export events as ICS text", async () => {
      mockPrisma.calendarEvent.findMany.mockResolvedValue([
        {
          id: "e1",
          title: "测试会议",
          description: "讨论",
          startAt: new Date("2026-08-14T10:00:00.000Z"),
          endAt: new Date("2026-08-14T11:00:00.000Z"),
        },
      ]);

      const result = await service.exportIcs("u1");

      expect(result.icsText).toContain("BEGIN:VCALENDAR");
      expect(result.icsText).toContain("测试会议");
      expect(result.icsText).toContain("DTSTART:20260814T100000Z");
    });
  });

  describe("syncExternalCalendar", () => {
    it("should fetch URL and import events", async () => {
      const ics = [
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT",
        "UID:url-1",
        "DTSTART:20260814T120000Z",
        "DTEND:20260814T130000Z",
        "SUMMARY:外部会议",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        text: async () => ics,
      } as any);

      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: "imported" });

      const result = await service.syncExternalCalendar(
        "u1",
        "https://example.com/cal.ics",
      );

      expect(result.imported).toEqual(1);
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: "外部会议" }),
        }),
      );
    });
  });
});
