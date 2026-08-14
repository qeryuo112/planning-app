import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

/**
 * 项目服务
 * 负责项目的 CRUD，项目可选关联到目标，一个目标下可包含多个项目。
 */
@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, dto: CreateProjectDto) {
    this.logger.debug(`创建项目: ${dto.title}, user=${userId}`);

    if (dto.goalId) {
      await this.ensureGoalExists(userId, dto.goalId);
    }

    const project = await this.prisma.project.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        goalId: dto.goalId,
      },
      include: { goal: true, tasks: true },
    });

    return project;
  }

  async findAll(userId: string) {
    this.logger.debug(`查询项目列表: user=${userId}`);

    return this.prisma.project.findMany({
      where: { userId },
      include: { goal: true, tasks: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(userId: string, id: string) {
    this.logger.debug(`查询项目详情: ${id}, user=${userId}`);

    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: { goal: true, tasks: true },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    return project;
  }

  async update(userId: string, id: string, dto: UpdateProjectDto) {
    this.logger.debug(`更新项目: ${id}, user=${userId}`);

    await this.findOne(userId, id);

    if (dto.goalId) {
      await this.ensureGoalExists(userId, dto.goalId);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.goalId !== undefined && { goalId: dto.goalId }),
      },
      include: { goal: true, tasks: true },
    });

    return project;
  }

  async remove(userId: string, id: string) {
    this.logger.debug(`删除项目: ${id}, user=${userId}`);

    await this.findOne(userId, id);
    await this.prisma.project.delete({ where: { id } });

    return { id, deleted: true };
  }

  private async ensureGoalExists(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    });

    if (!goal) {
      throw new NotFoundException("关联目标不存在");
    }
  }
}
