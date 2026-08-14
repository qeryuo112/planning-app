import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { TodayService } from "./today.service";

const mockPrisma = {
  task: {
    findMany: jest.fn(),
  },
  habit: {
    findMany: jest.fn(),
  },
  goal: {
    findMany: jest.fn(),
  },
};

describe("TodayService", () => {
  let service: TodayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodayService,
        { provide: PrismaClient, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TodayService>(TodayService);
    jest.clearAllMocks();
  });

  it("should return top 3 tasks sorted by score", async () => {
    mockPrisma.task.findMany
      .mockResolvedValueOnce([
        {
          id: "t1",
          title: "过期任务",
          scheduledDate: new Date("2026-08-10T00:00:00.000Z"),
          energyLevel: "low",
          durationMinutes: 60,
          status: "todo",
          weight: 1,
          milestone: null,
          project: null,
        },
        {
          id: "t2",
          title: "高精力任务",
          scheduledDate: new Date("2026-08-12T00:00:00.000Z"),
          energyLevel: "high",
          durationMinutes: 30,
          status: "todo",
          weight: 1,
          milestone: null,
          project: null,
        },
      ])
      .mockResolvedValueOnce([]);

    mockPrisma.habit.findMany.mockResolvedValue([]);
    mockPrisma.goal.findMany.mockResolvedValue([]);

    const result = await service.getToday("u1", "2026-08-12");

    expect(result.topTasks).toHaveLength(2);
    expect(result.topTasks[0].id).toEqual("t1");
    expect(result.topTasks[0].isOverdue).toEqual(true);
    expect(result.totalTasks).toEqual(2);
  });

  it("should calculate habit streak", async () => {
    mockPrisma.task.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockPrisma.habit.findMany.mockResolvedValue([
      {
        id: "h1",
        title: "早起",
        frequency: "daily",
        preferredTime: "07:00",
        energyLevel: "low",
        checkins: [
          { date: new Date("2026-08-12T00:00:00.000Z"), result: "completed" },
          { date: new Date("2026-08-11T00:00:00.000Z"), result: "completed" },
          { date: new Date("2026-08-10T00:00:00.000Z"), result: "completed" },
        ],
      },
    ]);

    mockPrisma.goal.findMany.mockResolvedValue([]);

    const result = await service.getToday("u1", "2026-08-12");

    expect(result.habits).toHaveLength(1);
    expect(result.habits[0].checkedToday).toEqual(true);
    expect(result.habits[0].currentStreak).toEqual(3);
    expect(result.habits[0].longestStreak).toEqual(3);
  });

  it("should calculate goal progress and streak", async () => {
    mockPrisma.task.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.habit.findMany.mockResolvedValue([]);

    mockPrisma.goal.findMany.mockResolvedValue([
      {
        id: "g1",
        title: "学英语",
        horizon: "short",
        milestones: [
          {
            id: "m1",
            title: "第一阶段",
            weight: 1,
            tasks: [
              { id: "t1", status: "done", weight: 1, checkins: [] },
              { id: "t2", status: "todo", weight: 1, checkins: [] },
            ],
          },
        ],
        projects: [],
        goalLinks: [],
      },
    ]);

    const result = await service.getToday("u1", "2026-08-12");

    expect(result.goals).toHaveLength(1);
    expect(result.goals[0].progress).toEqual(0.5);
    expect(result.goals[0].milestones[0].progress).toEqual(0.5);
  });
});
