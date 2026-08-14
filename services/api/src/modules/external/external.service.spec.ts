import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { ExternalService } from "./external.service";
import { SyncEventsService } from "../sync/sync-events.service";

const mockPrisma = {
  habit: {
    findFirst: jest.fn(),
  },
  externalActivity: {
    createMany: jest.fn(),
  },
  checkin: {
    create: jest.fn(),
  },
};

const mockSyncEventsService = {
  createEvent: jest.fn(),
};

describe("ExternalService", () => {
  let service: ExternalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: SyncEventsService, useValue: mockSyncEventsService },
      ],
    }).compile();

    service = module.get<ExternalService>(ExternalService);
    jest.clearAllMocks();
  });

  describe("importFitnessData", () => {
    it("should import activities without habit linkage", async () => {
      mockPrisma.externalActivity.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importFitnessData("u1", {
        source: "keep",
        activities: [
          {
            activityType: "run",
            startedAt: "2026-08-14T07:00:00.000Z",
            durationSeconds: 1800,
            distanceKm: 5,
            calories: 300,
          },
        ],
      });

      expect(result.activitiesImported).toEqual(1);
      expect(result.checkinsCreated).toEqual(0);
      expect(mockPrisma.externalActivity.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId: "u1",
              source: "keep",
              activityType: "run",
            }),
          ]),
          skipDuplicates: true,
        }),
      );
    });

    it("should create checkins when habitId provided", async () => {
      mockPrisma.habit.findFirst.mockResolvedValue({ id: "h1" });
      mockPrisma.externalActivity.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.checkin.create.mockResolvedValue({ id: "c1" });

      const result = await service.importFitnessData("u1", {
        source: "garmin",
        habitId: "h1",
        activities: [
          {
            activityType: "cycle",
            startedAt: "2026-08-14T08:00:00.000Z",
            durationSeconds: 3600,
          },
        ],
      });

      expect(result.activitiesImported).toEqual(1);
      expect(result.checkinsCreated).toEqual(1);
      expect(mockPrisma.checkin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "u1",
            habitId: "h1",
            result: "completed",
          }),
        }),
      );
    });

    it("should throw when habit does not belong to user", async () => {
      mockPrisma.habit.findFirst.mockResolvedValue(null);

      await expect(
        service.importFitnessData("u1", {
          source: "keep",
          habitId: "h1",
          activities: [
            {
              activityType: "run",
              startedAt: "2026-08-14T07:00:00.000Z",
            },
          ],
        }),
      ).rejects.toThrow("关联习惯不存在或无权访问");
    });
  });
});
