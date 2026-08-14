import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { CreateInboxItemDto } from "./dto/create-inbox-item.dto";
import { UpdateInboxItemDto } from "./dto/update-inbox-item.dto";
import { ConvertInboxItemDto } from "./dto/convert-inbox-item.dto";
import { SyncEventsService } from "../sync/sync-events.service";

/**
 * 收件箱服务
 * 提供快速记录的创建、整理与忽略。
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly syncEvents: SyncEventsService,
  ) {}

  async create(userId: string, dto: CreateInboxItemDto) {
    this.logger.debug(`创建收件箱条目: ${dto.title}`);

    const item = await this.prisma.inboxItem.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        status: "pending",
      },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "inbox.created",
      targetType: "inbox",
      targetId: item.id,
      payload: { title: item.title, status: item.status },
    });

    return item;
  }

  async findAll(userId: string) {
    this.logger.debug(`查询收件箱列表: user=${userId}`);

    return this.prisma.inboxItem.findMany({
      where: { userId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(userId: string, id: string, dto: UpdateInboxItemDto) {
    await this.findOne(userId, id);

    const item = await this.prisma.inboxItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "inbox.updated",
      targetType: "inbox",
      targetId: item.id,
      payload: { title: item.title, description: item.description },
    });

    return item;
  }

  async dismiss(userId: string, id: string) {
    await this.findOne(userId, id);

    const item = await this.prisma.inboxItem.update({
      where: { id },
      data: { status: "dismissed" },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "inbox.dismissed",
      targetType: "inbox",
      targetId: item.id,
      payload: { status: item.status },
    });

    return item;
  }

  async convert(userId: string, id: string, dto: ConvertInboxItemDto) {
    this.logger.debug(`整理收件箱条目: ${id} -> ${dto.targetType}`);

    const item = await this.findOne(userId, id);

    if (item.status !== "pending") {
      throw new BadRequestException("该条目已整理或已忽略");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let convertedToType: string | undefined;
      let convertedToId: string | undefined;

      if (dto.targetType === "task") {
        const today =
          dto.scheduledDate ?? new Date().toISOString().split("T")[0];
        const task = await tx.task.create({
          data: {
            userId,
            title: item.title,
            description: item.description ?? undefined,
            scheduledDate: new Date(`${today}T00:00:00.000Z`),
            status: "todo",
            energyLevel: "medium",
            projectId: dto.projectId,
            milestoneId: dto.milestoneId,
          },
        });
        convertedToType = "task";
        convertedToId = task.id;
      } else if (dto.targetType === "goal") {
        const goal = await tx.goal.create({
          data: {
            userId,
            title: item.title,
            description: item.description ?? undefined,
            horizon: "short",
          },
        });
        convertedToType = "goal";
        convertedToId = goal.id;
      } else if (dto.targetType === "project") {
        const project = await tx.project.create({
          data: {
            userId,
            title: item.title,
            description: item.description ?? undefined,
          },
        });
        convertedToType = "project";
        convertedToId = project.id;
      } else {
        throw new BadRequestException(`不支持的整理类型: ${dto.targetType}`);
      }

      const updatedItem = await tx.inboxItem.update({
        where: { id },
        data: {
          status: "converted",
          convertedToType,
          convertedToId,
        },
      });

      return { item: updatedItem, convertedToType, convertedToId };
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "inbox.converted",
      targetType: "inbox",
      targetId: result.item.id,
      payload: {
        convertedToType: result.convertedToType,
        convertedToId: result.convertedToId,
      },
    });

    return result;
  }

  private async findOne(userId: string, id: string) {
    const item = await this.prisma.inboxItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw new NotFoundException("收件箱条目不存在");
    }

    return item;
  }
}
