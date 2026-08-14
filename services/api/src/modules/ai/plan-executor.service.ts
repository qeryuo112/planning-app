import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PlanDraftPayload } from "./plan-orchestrator.service";
import { SyncEventsService } from "../sync/sync-events.service";

/**
 * 业务执行层
 * 将通过校验的计划草案写入业务实体，使用数据库事务保证一致性。
 */
@Injectable()
export class PlanExecutor {
  private readonly logger = new Logger(PlanExecutor.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly syncEvents: SyncEventsService,
  ) {}

  /**
   * 执行计划落库。
   * 创建 Goal、Milestones、Project、Tasks、Habits，并关联目标与习惯。
   * 若传入 existingGoalId，则复用已有目标，不再创建新 Goal。
   *
   * 分阶段模式下，只从 stages 中找出 isDetailed=true 的阶段，落库该阶段的 milestones 与 tasks；
   * 旧格式没有 stages 时，回退到顶层 milestones/tasks。
   */
  async executeDraft(
    userId: string,
    draft: PlanDraftPayload,
    planVersionId?: string,
    existingGoalId?: string,
  ): Promise<{ goalId: string; projectId: string; planVersionId?: string }> {
    this.logger.debug(
      `执行计划落库，目标: ${draft.goal.title}, user=${userId}`,
    );

    const detailedStage = Array.isArray(draft.stages)
      ? draft.stages.find((s) => s.isDetailed)
      : undefined;

    const activeMilestones = detailedStage
      ? detailedStage.milestones
      : draft.milestones;
    const activeTasks = detailedStage
      ? (detailedStage.tasks ?? [])
      : draft.tasks;

    const result = await this.prisma.$transaction(async (tx) => {
      let goal;
      if (existingGoalId) {
        goal = await tx.goal.findFirst({
          where: { id: existingGoalId, userId },
        });
        if (!goal) {
          throw new NotFoundException("关联目标不存在");
        }
      } else {
        goal = await tx.goal.create({
          data: {
            userId,
            title: draft.goal.title,
            horizon: draft.goal.horizon,
            dueDate: draft.goal.dueDate
              ? new Date(`${draft.goal.dueDate}T00:00:00.000Z`)
              : null,
            successCriteria: draft.goal.successCriteria ?? [],
          },
        });
      }

      const milestoneRecords = await Promise.all(
        activeMilestones.map((m) =>
          tx.milestone.create({
            data: {
              goalId: goal.id,
              title: m.title,
              weight: m.weight ?? 1 / Math.max(1, activeMilestones.length),
              dueDate: m.dueDate
                ? new Date(`${m.dueDate}T00:00:00.000Z`)
                : null,
            },
          }),
        ),
      );

      const project = await tx.project.create({
        data: {
          userId,
          goalId: goal.id,
          title: `${draft.goal.title} 项目`,
        },
      });

      const milestoneMap = this.buildMilestoneRefMap(
        activeMilestones,
        milestoneRecords,
      );

      let taskRecords: Array<{ id: string }> = [];
      if (activeTasks.length > 0) {
        await tx.task.createMany({
          data: activeTasks.map((t) => ({
            userId,
            projectId: project.id,
            milestoneId:
              milestoneMap.get(t.milestoneRef ?? "m1") ??
              milestoneRecords[0]?.id ??
              null,
            title: t.title,
            scheduledDate: t.date ? new Date(`${t.date}T00:00:00.000Z`) : null,
            energyLevel: t.energyLevel ?? "medium",
            durationMinutes: t.durationMinutes,
            minimumStandard: t.minimumStandard,
          })),
        });

        taskRecords = await tx.task.findMany({
          where: { projectId: project.id },
          select: { id: true },
        });
      }

      let habitRecords: Array<{ id: string }> = [];
      if (draft.habits.length > 0) {
        habitRecords = await Promise.all(
          draft.habits.map((h) =>
            tx.habit.create({
              data: {
                userId,
                title: h.title,
                frequency: h.frequency as any,
                preferredTime: h.preferredTime,
                energyLevel: h.energyLevel ?? "medium",
                minimumStandard: h.minimumStandard,
                goalLinks: {
                  create: [{ goalId: goal.id }],
                },
              },
            }),
          ),
        );
      }

      if (planVersionId) {
        await tx.planVersion.update({
          where: { id: planVersionId },
          data: { approvedAt: new Date() },
        });
      }

      return { goal, project, taskRecords, habitRecords };
    });

    // 事务外广播同步事件
    await this.syncEvents.createEvent(userId, {
      eventType: "goal.created",
      targetType: "goal",
      targetId: result.goal.id,
      payload: { title: result.goal.title, horizon: result.goal.horizon },
    });

    for (const task of result.taskRecords) {
      await this.syncEvents.createEvent(userId, {
        eventType: "task.created",
        targetType: "task",
        targetId: task.id,
        payload: { source: "plan" },
      });
    }

    for (const habit of result.habitRecords) {
      await this.syncEvents.createEvent(userId, {
        eventType: "habit.created",
        targetType: "habit",
        targetId: habit.id,
        payload: { source: "plan" },
      });
    }

    return {
      goalId: result.goal.id,
      projectId: result.project.id,
      planVersionId,
    };
  }

  /**
   * 将 draft 中的 milestoneRef（如 "m1", "m2"）映射到实际 milestone ID。
   * 默认 "m1" 对应第 1 个里程碑，"m2" 对应第 2 个，依此类推。
   */
  private buildMilestoneRefMap(
    draftMilestones: PlanDraftPayload["milestones"],
    milestoneRecords: Array<{ id: string }>,
  ): Map<string, string> {
    const map = new Map<string, string>();

    draftMilestones.forEach((m, index) => {
      const ref = m.title ? `m${index + 1}` : `m${index + 1}`;
      const record = milestoneRecords[index];
      if (record) {
        map.set(ref, record.id);
      }
    });

    return map;
  }
}
