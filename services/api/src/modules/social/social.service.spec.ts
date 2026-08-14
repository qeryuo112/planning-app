import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { SocialService } from "./social.service";

const mockPrisma = {
  goal: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  goalShare: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  challenge: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  challengeParticipant: {
    create: jest.fn(),
  },
  checkin: {
    count: jest.fn(),
  },
  task: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

describe("SocialService", () => {
  let service: SocialService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        { provide: PrismaClient, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SocialService>(SocialService);
    jest.clearAllMocks();
  });

  describe("shareGoal", () => {
    it("should create a goal share for an existing recipient", async () => {
      mockPrisma.goal.findFirst.mockResolvedValue({ id: "g1", userId: "u1" });
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u2" });
      mockPrisma.goalShare.findFirst.mockResolvedValue(null);
      mockPrisma.goalShare.create.mockResolvedValue({ id: "s1" });

      const result = await service.shareGoal("u1", "g1", {
        sharedWithEmail: "friend@test.com",
      });

      expect(result.id).toEqual("s1");
      expect(mockPrisma.goalShare.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            goalId: "g1",
            ownerId: "u1",
            sharedWithUserId: "u2",
            permission: "view",
          }),
        }),
      );
    });

    it("should throw if recipient does not exist", async () => {
      mockPrisma.goal.findFirst.mockResolvedValue({ id: "g1", userId: "u1" });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.shareGoal("u1", "g1", { sharedWithEmail: "nope@test.com" }),
      ).rejects.toThrow("接收用户不存在");
    });
  });

  describe("respondToShare", () => {
    it("should accept a pending share", async () => {
      mockPrisma.goalShare.findFirst.mockResolvedValue({
        id: "s1",
        sharedWithUserId: "u2",
        status: "pending",
      });
      mockPrisma.goalShare.update.mockResolvedValue({
        id: "s1",
        status: "accepted",
      });

      const result = await service.respondToShare("u2", "s1", {
        status: "accepted",
      });

      expect(result.status).toEqual("accepted");
      expect(mockPrisma.goalShare.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "s1" },
          data: { status: "accepted" },
        }),
      );
    });
  });

  describe("createChallenge", () => {
    it("should create a challenge and add creator as participant", async () => {
      mockPrisma.challenge.create.mockResolvedValue({
        id: "c1",
        title: "挑战",
      });
      mockPrisma.challenge.findUnique = jest.fn().mockResolvedValue({
        id: "c1",
        title: "挑战",
        participants: [
          { userId: "u1", user: { id: "u1", email: "a@test.com" } },
        ],
      });
      mockPrisma.challengeParticipant.create.mockResolvedValue({});

      const result = await service.createChallenge("u1", {
        title: "7 天早起挑战",
        type: "habit_streak",
        startDate: "2026-08-13",
        endDate: "2026-08-20",
      });

      expect(result.id).toEqual("c1");
      expect(mockPrisma.challengeParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { challengeId: "c1", userId: "u1" },
        }),
      );
    });
  });

  describe("joinChallenge", () => {
    it("should add user to an active challenge", async () => {
      mockPrisma.challenge.findUnique = jest.fn().mockResolvedValue({
        id: "c1",
        status: "active",
        participants: [],
      });
      mockPrisma.challengeParticipant.create.mockResolvedValue({});

      await service.joinChallenge("u2", "c1");

      expect(mockPrisma.challengeParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { challengeId: "c1", userId: "u2" },
        }),
      );
    });
  });

  describe("getLeaderboard", () => {
    it("should compute task_count leaderboard", async () => {
      mockPrisma.challenge.findFirst.mockResolvedValue({
        id: "c1",
        title: "挑战",
        type: "task_count",
        startDate: new Date("2026-08-01T00:00:00Z"),
        endDate: new Date("2026-08-31T23:59:59Z"),
        participants: [
          { userId: "u1", user: { id: "u1", email: "a@test.com" } },
          { userId: "u2", user: { id: "u2", email: "b@test.com" } },
        ],
      });
      mockPrisma.task.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);

      const result = await service.getLeaderboard("u1", "c1");

      expect(result.entries[0].score).toEqual(5);
      expect(result.entries[1].score).toEqual(3);
      expect(result.entries[0].rank).toEqual(1);
    });
  });
});
