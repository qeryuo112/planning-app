import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { AiCleanupService } from "./ai-cleanup.service";

describe("AiCleanupService", () => {
  let service: AiCleanupService;
  let prisma: PrismaClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiCleanupService,
        {
          provide: PrismaClient,
          useValue: {
            $queryRaw: jest.fn(),
            aIDailyCostSummary: { upsert: jest.fn() },
            aIOperation: { deleteMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<AiCleanupService>(AiCleanupService);
    prisma = module.get<PrismaClient>(PrismaClient);
  });

  it("应汇总并删除过期 AIOperation", async () => {
    const mockAggregated = [
      {
        userId: "user-1",
        date: new Date("2026-07-01"),
        totalCost: 0.5,
        callCount: 2,
      },
      {
        userId: "user-2",
        date: new Date("2026-07-02"),
        totalCost: 0.3,
        callCount: 1,
      },
    ];

    (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockAggregated);
    (prisma.aIDailyCostSummary.upsert as jest.Mock).mockResolvedValue({});
    (prisma.aIOperation.deleteMany as jest.Mock).mockResolvedValue({
      count: 3,
    });

    await service.runCleanup();

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.aIDailyCostSummary.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.aIOperation.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: expect.objectContaining({ lt: expect.any(Date) }) },
    });
  });

  it("无过期记录时不应报错", async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    (prisma.aIDailyCostSummary.upsert as jest.Mock).mockResolvedValue({});
    (prisma.aIOperation.deleteMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await service.runCleanup();

    expect(prisma.aIDailyCostSummary.upsert).not.toHaveBeenCalled();
    expect(prisma.aIOperation.deleteMany).toHaveBeenCalled();
  });
});
