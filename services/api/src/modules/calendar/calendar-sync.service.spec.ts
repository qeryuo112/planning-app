import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { CalendarSyncService } from "./calendar-sync.service";
import { CalendarService } from "./calendar.service";
import { CalendarOAuthService } from "./calendar-oauth.service";

const mockPrisma = {
  calendarSubscription: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockCalendarService = {
  syncExternalCalendar: jest.fn(),
};

const mockOAuthService = {
  syncGoogleSubscription: jest.fn(),
};

describe("CalendarSyncService", () => {
  let service: CalendarSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarSyncService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: CalendarService, useValue: mockCalendarService },
        { provide: CalendarOAuthService, useValue: mockOAuthService },
      ],
    }).compile();

    service = module.get<CalendarSyncService>(CalendarSyncService);
    jest.clearAllMocks();
  });

  describe("syncSubscription", () => {
    it("should sync ICS subscription", async () => {
      mockPrisma.calendarSubscription.findUnique.mockResolvedValue({
        id: "sub-1",
        userId: "u1",
        source: "ics",
        url: "https://example.com/cal.ics",
        isActive: true,
      });
      mockCalendarService.syncExternalCalendar.mockResolvedValue({
        imported: 2,
        total: 2,
      });

      await service.syncSubscription("sub-1");

      expect(mockCalendarService.syncExternalCalendar).toHaveBeenCalledWith(
        "u1",
        "https://example.com/cal.ics",
      );
      expect(mockPrisma.calendarSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastSyncResult: { imported: 2, total: 2 },
          }),
        }),
      );
    });

    it("should sync Google subscription", async () => {
      mockPrisma.calendarSubscription.findUnique.mockResolvedValue({
        id: "sub-2",
        userId: "u1",
        source: "google",
        calendarId: "primary",
        isActive: true,
      });
      mockOAuthService.syncGoogleSubscription.mockResolvedValue(undefined);

      await service.syncSubscription("sub-2");

      expect(mockOAuthService.syncGoogleSubscription).toHaveBeenCalledWith(
        "sub-2",
      );
    });

    it("should record error when sync fails", async () => {
      mockPrisma.calendarSubscription.findUnique.mockResolvedValue({
        id: "sub-3",
        userId: "u1",
        source: "ics",
        url: "https://example.com/cal.ics",
        isActive: true,
      });
      mockCalendarService.syncExternalCalendar.mockRejectedValue(
        new Error("fetch failed"),
      );

      await service.syncSubscription("sub-3");

      expect(mockPrisma.calendarSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastSyncResult: { error: "fetch failed" },
          }),
        }),
      );
    });
  });

  describe("syncAllActiveSubscriptions", () => {
    it("should sync all active subscriptions serially", async () => {
      mockPrisma.calendarSubscription.findMany.mockResolvedValue([
        {
          id: "sub-1",
          userId: "u1",
          source: "ics",
          url: "https://example.com/cal.ics",
          isActive: true,
        },
      ]);
      mockCalendarService.syncExternalCalendar.mockResolvedValue({
        imported: 1,
        total: 1,
      });

      await service.syncAllActiveSubscriptions();

      expect(mockCalendarService.syncExternalCalendar).toHaveBeenCalledTimes(1);
    });
  });
});
