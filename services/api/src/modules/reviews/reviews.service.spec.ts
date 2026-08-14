import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { ReviewsService } from "./reviews.service";
import { ReviewPeriod } from "./dto/create-review.dto";

const mockPrisma = {
  review: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  goal: { findFirst: jest.fn() },
};

describe("ReviewsService", () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaClient, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a weekly review", async () => {
      mockPrisma.goal.findFirst.mockResolvedValue({ id: "g1" });
      mockPrisma.review.create.mockResolvedValue({ id: "rev1" });

      const result = await service.create("u1", {
        goalId: "g1",
        period: ReviewPeriod.WEEKLY,
        startDate: "2026-08-04",
        endDate: "2026-08-11",
        summary: "本周完成率 80%",
        insights: { doneTasks: 4 },
        nextActions: { actions: [{ title: "继续" }] },
      });

      expect(result.id).toEqual("rev1");
      expect(mockPrisma.review.create).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return reviews filtered by goalId", async () => {
      mockPrisma.review.findMany.mockResolvedValue([{ id: "rev1" }]);

      const result = await service.findAll("u1", "g1");

      expect(result).toHaveLength(1);
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "u1", goalId: "g1" },
        }),
      );
    });
  });
});
