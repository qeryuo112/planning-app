import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { CreateReviewDto } from "./dto/create-review.dto";

/**
 * 复盘服务
 * 负责创建与查询日/周复盘记录。
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, dto: CreateReviewDto) {
    this.logger.debug(
      `创建复盘: goal=${dto.goalId}, period=${dto.period}, user=${userId}`,
    );

    const goal = await this.prisma.goal.findFirst({
      where: { id: dto.goalId, userId },
      select: { id: true },
    });

    if (!goal) {
      throw new NotFoundException("目标不存在");
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        goalId: dto.goalId,
        period: dto.period,
        startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
        endDate: new Date(`${dto.endDate}T23:59:59.999Z`),
        summary: dto.summary,
        insights: JSON.parse(
          JSON.stringify(dto.insights),
        ) as Prisma.InputJsonValue,
        nextActions: JSON.parse(
          JSON.stringify(dto.nextActions),
        ) as Prisma.InputJsonValue,
      },
    });

    return review;
  }

  async findAll(userId: string, goalId?: string) {
    this.logger.debug(`查询复盘列表: user=${userId}, goalId=${goalId}`);

    return this.prisma.review.findMany({
      where: { userId, ...(goalId && { goalId }) },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(userId: string, id: string) {
    this.logger.debug(`查询复盘详情: ${id}, user=${userId}`);

    const review = await this.prisma.review.findFirst({
      where: { id, userId },
    });

    if (!review) {
      throw new NotFoundException("复盘不存在");
    }

    return review;
  }
}
