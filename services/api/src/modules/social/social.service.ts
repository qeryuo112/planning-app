import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ShareGoalDto } from "./dto/share-goal.dto";
import { RespondShareDto } from "./dto/respond-share.dto";
import { CreateChallengeDto } from "./dto/create-challenge.dto";

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(private readonly prisma: PrismaClient) {}

  async shareGoal(userId: string, goalId: string, dto: ShareGoalDto) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });
    if (!goal) {
      throw new NotFoundException("目标不存在或无权分享");
    }

    const sharedWith = await this.prisma.user.findUnique({
      where: { email: dto.sharedWithEmail },
      select: { id: true },
    });
    if (!sharedWith) {
      throw new NotFoundException("接收用户不存在");
    }
    if (sharedWith.id === userId) {
      throw new BadRequestException("不能分享给自己");
    }

    const existing = await this.prisma.goalShare.findFirst({
      where: { goalId, ownerId: userId, sharedWithUserId: sharedWith.id },
    });
    if (existing) {
      throw new BadRequestException("已共享给该用户");
    }

    return this.prisma.goalShare.create({
      data: {
        goalId,
        ownerId: userId,
        sharedWithEmail: dto.sharedWithEmail,
        sharedWithUserId: sharedWith.id,
        permission: dto.permission ?? "view",
      },
      include: { goal: true, owner: { select: { email: true } } },
    });
  }

  async listReceivedShares(userId: string, status?: string) {
    const where: any = { sharedWithUserId: userId };
    if (status) where.status = status;
    return this.prisma.goalShare.findMany({
      where,
      include: {
        goal: {
          include: {
            milestones: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listOwnedShares(userId: string) {
    return this.prisma.goalShare.findMany({
      where: { ownerId: userId },
      include: {
        goal: { select: { title: true } },
        sharedWith: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async respondToShare(userId: string, shareId: string, dto: RespondShareDto) {
    const share = await this.prisma.goalShare.findFirst({
      where: { id: shareId, sharedWithUserId: userId },
    });
    if (!share) {
      throw new NotFoundException("共享邀请不存在");
    }
    if (share.status !== "pending") {
      throw new BadRequestException("邀请已处理");
    }
    return this.prisma.goalShare.update({
      where: { id: shareId },
      data: { status: dto.status },
      include: { goal: true },
    });
  }

  async createChallenge(userId: string, dto: CreateChallengeDto) {
    const challenge = await this.prisma.challenge.create({
      data: {
        creatorId: userId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        targetValue: dto.targetValue,
        startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
        endDate: new Date(`${dto.endDate}T23:59:59.999Z`),
      },
    });

    await this.prisma.challengeParticipant.create({
      data: { challengeId: challenge.id, userId },
    });

    return this.findChallengeById(challenge.id);
  }

  async listChallenges(userId: string, status?: string) {
    const where: any = {};
    if (status) where.status = status;
    return this.prisma.challenge.findMany({
      where,
      include: {
        creator: { select: { email: true } },
        participants: {
          include: { user: { select: { id: true, email: true } } },
        },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async joinChallenge(userId: string, challengeId: string) {
    const challenge = await this.findChallengeById(challengeId);
    if (!challenge) {
      throw new NotFoundException("挑战不存在");
    }
    if (challenge.status !== "active") {
      throw new BadRequestException("挑战已结束或未开始");
    }
    try {
      await this.prisma.challengeParticipant.create({
        data: { challengeId, userId },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        throw new BadRequestException("已加入该挑战");
      }
      throw err;
    }
    return this.findChallengeById(challengeId);
  }

  async getLeaderboard(userId: string, challengeId: string) {
    const challenge = await this.prisma.challenge.findFirst({
      where: { id: challengeId },
      include: {
        participants: {
          include: { user: { select: { id: true, email: true } } },
        },
      },
    });
    if (!challenge) {
      throw new NotFoundException("挑战不存在");
    }

    const scores = await Promise.all(
      challenge.participants.map(async (p) => ({
        userId: p.userId,
        email: p.user.email,
        score: await this.computeScore(p.userId, challenge),
      })),
    );

    scores.sort((a, b) => b.score - a.score);
    const rankMap = new Map(scores.map((s, i) => [s.userId, i + 1]));

    return {
      challengeId,
      title: challenge.title,
      type: challenge.type,
      targetValue: challenge.targetValue,
      startDate: challenge.startDate.toISOString().split("T")[0],
      endDate: challenge.endDate.toISOString().split("T")[0],
      myRank: rankMap.get(userId) ?? null,
      entries: scores.map((s) => ({
        userId: s.userId,
        email: s.email,
        score: s.score,
        rank: rankMap.get(s.userId),
      })),
    };
  }

  private async findChallengeById(id: string) {
    return this.prisma.challenge.findUnique({
      where: { id },
      include: {
        creator: { select: { email: true } },
        participants: {
          include: { user: { select: { id: true, email: true } } },
        },
        _count: { select: { participants: true } },
      },
    });
  }

  private async computeScore(
    userId: string,
    challenge: { type: string; startDate: Date; endDate: Date },
  ): Promise<number> {
    const start = challenge.startDate;
    const end = challenge.endDate;

    if (challenge.type === "habit_streak") {
      const count = await this.prisma.checkin.count({
        where: {
          userId,
          habitId: { not: null },
          date: { gte: start, lte: end },
          result: { in: ["completed", "partial", "makeup"] },
        },
      });
      return count;
    }

    if (challenge.type === "task_count") {
      const count = await this.prisma.task.count({
        where: {
          userId,
          status: "done",
          updatedAt: { gte: start, lte: end },
        },
      });
      return count;
    }

    if (challenge.type === "goal_progress") {
      const tasks = await this.prisma.task.findMany({
        where: {
          userId,
          scheduledDate: { gte: start, lte: end },
        },
        select: { status: true },
      });
      if (tasks.length === 0) return 0;
      const done = tasks.filter((t) => t.status === "done").length;
      return Math.round((done / tasks.length) * 100);
    }

    return 0;
  }
}
