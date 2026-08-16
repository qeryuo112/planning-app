import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Observable, Subscriber } from "rxjs";
import { PrismaClient } from "@prisma/client";
import { ModelAdapter } from "./model-adapter.service";
import {
  PlanOrchestrator,
  PlanDraftPayload,
} from "./plan-orchestrator.service";
import { PlanExecutor } from "./plan-executor.service";
import { CreatePlanDraftDto } from "./dto/create-plan-draft.dto";
import { ApprovePlanDto } from "./dto/approve-plan.dto";
import { ReplanDto } from "./dto/replan.dto";
import { ReviewDto } from "./dto/review.dto";
import { AnalyticsService } from "../analytics/analytics.service";
import { SyncEventsService } from "../sync/sync-events.service";
import { AiSessionService } from "./ai-session.service";
import {
  AITemplate,
  findTemplateById,
  recommendTemplate,
  listTemplates,
  UserHistoryHint,
} from "./templates/ai-templates";

/**
 * AI 服务门面
 * 协调模型适配、计划编排与计划执行三层。
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly promptVersion = "placeholder-v1";

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaClient,
    private readonly modelAdapter: ModelAdapter,
    private readonly orchestrator: PlanOrchestrator,
    private readonly executor: PlanExecutor,
    private readonly analytics: AnalyticsService,
    private readonly syncEvents: SyncEventsService,
    private readonly aiSession: AiSessionService,
  ) {}

  async createDraft(userId: string, dto: CreatePlanDraftDto) {
    this.logger.debug(
      `创建计划草案，输入: ${dto.userInput}, followUp=${dto.followUp ?? "-"}, session=${dto.sessionId ?? "new"}, user=${userId}`,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        availableTime: true,
        energyCurve: true,
      },
    });

    const userPreferences = {
      timezone: user?.timezone ?? "Asia/Shanghai",
      availableTime: (user?.availableTime as Record<string, unknown>) ?? {},
      energyCurve: (user?.energyCurve as Record<string, unknown>) ?? {},
    };

    const template = dto.templateId
      ? findTemplateById(dto.templateId)
      : await this.recommendTemplateWithHistory(userId, dto.userInput);

    const model = this.resolveModel("cheap");
    const config = this.modelAdapter.getConfig(model);

    const constraints = {
      planDuration: dto.planDuration,
      stageLength: dto.stageLength,
      currentStage: dto.currentStage,
      ...(dto.constraints ?? {}),
      userPreferences,
    };

    const effectiveInput = dto.followUp ?? dto.userInput;

    // 多轮会话管理
    const session = dto.sessionId
      ? await this.aiSession.getSession(userId, dto.sessionId)
      : await this.aiSession.getOrCreateSession(
          userId,
          dto.goalId ? "goal" : "general",
          dto.goalId,
        );

    await this.aiSession.addMessage({
      sessionId: session.id,
      role: "user",
      content: effectiveInput,
      metadata: { templateId: template?.id, goalId: dto.goalId },
    });

    const recentMessages = await this.aiSession.getMessages(session.id, 20);
    const history = this.aiSession.toChatMessages(recentMessages);

    const context = {
      ...userPreferences,
      userInput: effectiveInput,
      constraints: dto.constraints,
      templateId: template?.id,
      sessionId: session.id,
    };

    const costCheck = await this.checkDailyCostLimit(userId, model);
    let generation: {
      draft: any;
      fallback: boolean;
      error?: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };
    let fallbackReason: string | null = null;
    let latency = 0;

    if (costCheck.exceeded) {
      fallbackReason = `日费用上限已触发（当前 $${costCheck.current.toFixed(4)} / $${costCheck.limit.toFixed(2)} USD），已降级为模板草案`;
      this.logger.warn(fallbackReason);
      generation = {
        draft: template
          ? this.orchestrator.buildTemplateFallbackDraft(template, constraints)
          : this.orchestrator.buildFallbackDraft(dto.userInput, constraints),
        fallback: true,
        error: fallbackReason,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } else {
      const start = Date.now();
      generation = await this.orchestrator.generateDraft(
        effectiveInput,
        constraints,
        template,
        model,
        history,
      );
      latency = Date.now() - start;
      if (generation.fallback) {
        fallbackReason =
          generation.error ?? "模型生成失败或校验不通过，已降级到占位草案";
      }

      // 负载检测
      const payload = generation.draft;
      const availableWeeklyMinutes = this.computeAvailableWeeklyMinutes(
        userPreferences.availableTime,
      );
      const estimatedMinutes =
        payload.estimatedWeeklyLoad?.totalMinutes ??
        (payload.tasks?.length ?? 0) * 30;
      const overload = estimatedMinutes > availableWeeklyMinutes;
      if (overload && !fallbackReason) {
        const warning = `当前阶段每周预计 ${estimatedMinutes} 分钟，超出你设置的 ${availableWeeklyMinutes} 分钟可用时间。建议缩短计划时长或降低任务频率。`;
        payload.warnings = payload.warnings ?? [];
        if (!payload.warnings.includes(warning)) {
          payload.warnings.push(warning);
        }
      }
    }

    const payload = generation.draft;
    fallbackReason = generation.fallback
      ? (generation.error ?? "模型生成失败或校验不通过，已降级到占位草案")
      : null;

    const whereGoalId = dto.goalId ? { goalId: dto.goalId } : {};
    const latestVersion = await this.prisma.planVersion.findFirst({
      where: whereGoalId,
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    const versionNo = (latestVersion?.versionNo ?? 0) + 1;

    const planVersion = await this.prisma.planVersion.create({
      data: {
        goalId: dto.goalId ?? null,
        versionNo,
        source: generation.fallback
          ? template
            ? "template"
            : "fallback"
          : "ai",
        planDuration: payload.planDuration ?? null,
        stageLength: payload.stageLength ?? null,
        currentStage: payload.currentStage ?? null,
        totalStages: payload.totalStages ?? null,
        payload: payload as any,
        userFeedback: { context, fallbackReason } as any,
      },
    });

    const actualCost = this.estimateCost(
      config.model,
      generation.usage?.promptTokens ?? 0,
      generation.usage?.completionTokens ?? 0,
    );

    await this.prisma.aIOperation.create({
      data: {
        userId,
        sessionId: session.id,
        model: config.model,
        promptVersion: this.promptVersion,
        inputTokens: generation.usage?.promptTokens ?? 0,
        outputTokens: generation.usage?.completionTokens ?? 0,
        latencyMs: latency,
        cost: actualCost,
        result: {
          draftId: planVersion.id,
          source: generation.fallback ? "fallback" : "ai",
          error: generation.error ?? undefined,
          dailyCostAtCall: Number(
            (costCheck.current + (actualCost ?? 0)).toFixed(6),
          ),
        } as any,
      },
    });

    const availableWeeklyMinutes = this.computeAvailableWeeklyMinutes(
      userPreferences.availableTime,
    );
    const estimatedMinutes =
      payload.estimatedWeeklyLoad?.totalMinutes ??
      (payload.tasks?.length ?? 0) * 30;
    const overload =
      !generation.fallback && estimatedMinutes > availableWeeklyMinutes;

    void this.analytics.track({
      userId,
      eventType: "ai.draft.created",
      targetId: planVersion.id,
      metadata: {
        fallback: !!fallbackReason,
        overload,
        source: generation.fallback
          ? (template ? "template" : "fallback")
          : "ai",
        model: config.model,
        sessionId: session.id,
      },
    });

    void this.aiSession.addMessage({
      sessionId: session.id,
      role: "assistant",
      content: JSON.stringify({
        draftId: planVersion.id,
        goalTitle: payload.goal?.title,
        stageCount: payload.stages?.length,
        taskCount: payload.tasks?.length,
        fallback: !!fallbackReason,
      }),
      metadata: { planVersionId: planVersion.id, fallback: !!fallbackReason },
    });

    void this.aiSession.maybeSummarize(session.id);

    return {
      draftId: planVersion.id,
      status: "draft",
      plan: payload,
      fallback: !!fallbackReason,
      error: fallbackReason ?? undefined,
      overload,
      availableWeeklyMinutes,
      sessionId: session.id,
    };
  }

  /**
   * 创建流式计划草案的初始记录。
   * 仅落库一个 pending 状态的 PlanVersion，不调用模型，供前端随后连接 SSE 流。
   */
  async createStreamDraft(userId: string, dto: CreatePlanDraftDto) {
    this.logger.debug(
      `创建流式计划草案初始记录，输入: ${dto.userInput}, user=${userId}`,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        availableTime: true,
        energyCurve: true,
      },
    });

    const userPreferences = {
      timezone: user?.timezone ?? "Asia/Shanghai",
      availableTime: (user?.availableTime as Record<string, unknown>) ?? {},
      energyCurve: (user?.energyCurve as Record<string, unknown>) ?? {},
    };

    const template = dto.templateId
      ? findTemplateById(dto.templateId)
      : await this.recommendTemplateWithHistory(userId, dto.userInput);

    const _constraints = {
      planDuration: dto.planDuration,
      stageLength: dto.stageLength,
      currentStage: dto.currentStage,
      ...(dto.constraints ?? {}),
      userPreferences,
    };
    void _constraints;

    const context = {
      ...userPreferences,
      userInput: dto.userInput,
      constraints: dto.constraints,
      templateId: template?.id,
    };

    const latestVersion = await this.prisma.planVersion.findFirst({
      where: dto.goalId ? { goalId: dto.goalId } : {},
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    const versionNo = (latestVersion?.versionNo ?? 0) + 1;

    const planVersion = await this.prisma.planVersion.create({
      data: {
        goalId: dto.goalId ?? null,
        versionNo,
        source: "ai",
        planDuration: dto.planDuration ?? null,
        stageLength: dto.stageLength ?? null,
        currentStage: dto.currentStage ?? null,
        totalStages: null,
        payload: { status: "pending" } as any,
        userFeedback: { context, templateId: template?.id } as any,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "ai.draft.stream_started",
      targetId: planVersion.id,
      metadata: {
        templateId: template?.id,
        goalId: dto.goalId,
      },
    });

    return {
      draftId: planVersion.id,
      status: "pending",
      message: "已创建流式草案，请连接 SSE 端点获取结果",
    };
  }

  private estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number | null {
    // 单价：美元 / 1M tokens
    const prices: Record<string, { input: number; output: number }> = {
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "gpt-4o": { input: 5.0, output: 15.0 },
      "deepseek-chat": { input: 0.14, output: 0.28 },
      "deepseek-reasoner": { input: 0.55, output: 2.19 },
      "deepseek-v4-flash": { input: 0.1, output: 0.2 },
    };

    const price = prices[model];
    if (!price) return null;

    return (
      (inputTokens * price.input + outputTokens * price.output) / 1_000_000
    );
  }

  private estimateMaxCallCost(model: string): number {
    // 按一次最大可能调用估算：2000 prompt + 4000 completion tokens
    return this.estimateCost(model, 2000, 4000) ?? 1.0;
  }

  private getDailyCostLimit(): number {
    const raw = this.configService.get<string>("AI_DAILY_COST_LIMIT_USD");
    const parsed = raw ? parseFloat(raw) : NaN;
    return !isNaN(parsed) && parsed > 0 ? parsed : 1.0;
  }

  private async getDailyCostSoFar(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const agg = await this.prisma.aIOperation.aggregate({
      _sum: { cost: true },
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    });
    return (agg._sum?.cost as number) ?? 0;
  }

  private async checkDailyCostLimit(
    userId: string,
    model: string,
  ): Promise<{ exceeded: boolean; current: number; limit: number }> {
    const limit = this.getDailyCostLimit();
    const current = await this.getDailyCostSoFar(userId);
    const estimated = this.estimateMaxCallCost(model);
    return {
      exceeded: current + estimated > limit,
      current,
      limit,
    };
  }

  private computeAvailableWeeklyMinutes(
    availableTime: Record<string, unknown>,
  ): number {
    if (!availableTime || !Array.isArray(availableTime)) {
      return 420; // 默认每天 1 小时 * 7 天
    }
    const slots = availableTime as Array<{
      dayOfWeek?: string | number;
      startTime?: string;
      endTime?: string;
    }>;
    let total = 0;
    for (const slot of slots) {
      if (!slot.startTime || !slot.endTime) continue;
      const [sh, sm] = slot.startTime.split(":").map(Number);
      const [eh, em] = slot.endTime.split(":").map(Number);
      if (isNaN(sh) || isNaN(eh)) continue;
      const start = sh * 60 + (sm || 0);
      const end = eh * 60 + (em || 0);
      total += Math.max(0, end - start);
    }
    return total > 0 ? total : 420;
  }

  async getDraft(userId: string, id: string) {
    this.logger.debug(`获取计划草案: ${id}, user=${userId}`);

    const planVersion = await this.prisma.planVersion.findFirst({
      where: { id },
    });

    if (!planVersion) {
      throw new NotFoundException("计划草案不存在");
    }

    return {
      draftId: planVersion.id,
      status: planVersion.approvedAt ? "approved" : "draft",
      plan: planVersion.payload,
      approvedAt: planVersion.approvedAt,
    };
  }

  streamDraft(userId: string, id: string): Observable<{ data: string }> {
    this.logger.debug(`流式推送计划草案: ${id}, user=${userId}`);
    return new Observable<{ data: string }>((subscriber) => {
      this.runStreamDraft(userId, id, subscriber).catch((err) => {
        this.logger.error(`streamDraft 异常: ${(err as Error).message}`);
        if (!subscriber.closed) {
          subscriber.next({
            data: JSON.stringify({
              type: "error",
              error: (err as Error).message,
            }),
          });
          subscriber.complete();
        }
      });
    });
  }

  private async runStreamDraft(
    userId: string,
    id: string,
    subscriber: Subscriber<{ data: string }>,
  ) {
    const planVersion = await this.prisma.planVersion.findFirst({
      where: { id },
      include: { goal: true },
    });

    if (!planVersion) {
      subscriber.next({
        data: JSON.stringify({ type: "error", error: "计划草案不存在" }),
      });
      subscriber.complete();
      return;
    }

    if (planVersion.goal && planVersion.goal.userId !== userId) {
      subscriber.next({
        data: JSON.stringify({ type: "error", error: "无权访问该计划草案" }),
      });
      subscriber.complete();
      return;
    }

    const feedback = (planVersion.userFeedback as Record<string, any>) ?? {};
    const context = feedback.context ?? {};
    const userInput = context.userInput as string | undefined;

    if (!userInput) {
      subscriber.next({
        data: JSON.stringify({
          type: "error",
          error: "该草案缺少生成上下文，无法流式生成",
        }),
      });
      subscriber.complete();
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, availableTime: true, energyCurve: true },
    });

    const userPreferences = {
      timezone: user?.timezone ?? "Asia/Shanghai",
      availableTime: (user?.availableTime as Record<string, unknown>) ?? {},
      energyCurve: (user?.energyCurve as Record<string, unknown>) ?? {},
    };

    const template = context.templateId
      ? findTemplateById(context.templateId as string)
      : undefined;

    const constraints = {
      planDuration: planVersion.planDuration ?? undefined,
      stageLength: planVersion.stageLength ?? undefined,
      currentStage: planVersion.currentStage ?? 1,
      ...((context.constraints as Record<string, unknown>) ?? {}),
      userPreferences,
    };

    const model = this.resolveModel("cheap");
    const config = this.modelAdapter.getConfig(model);
    const costCheck = await this.checkDailyCostLimit(userId, model);

    let payload: PlanDraftPayload;
    let fallback = false;
    let fallbackReason: string | null = null;
    let usage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    let latency = 0;

    if (costCheck.exceeded) {
      fallbackReason = `日费用上限已触发（当前 $${costCheck.current.toFixed(4)} / $${costCheck.limit.toFixed(2)} USD），已降级为模板草案`;
      subscriber.next({
        data: JSON.stringify({
          type: "progress",
          stage: "cost_limit_exceeded",
          message: fallbackReason,
        }),
      });
      payload = template
        ? this.orchestrator.buildTemplateFallbackDraft(template, constraints)
        : this.orchestrator.buildFallbackDraft(userInput, constraints);
      fallback = true;
    } else {
      const start = Date.now();
      for await (const event of this.orchestrator.generateDraftStream(
        userInput,
        constraints,
        template,
        model,
      )) {
        if (subscriber.closed) return;

        if (event.type === "progress") {
          subscriber.next({
            data: JSON.stringify({
              type: "progress",
              stage: event.stage,
              message: event.message,
            }),
          });
        } else {
          payload = event.draft;
          fallback = event.fallback;
          fallbackReason = event.error ?? null;
          usage = event.usage ?? usage;
        }
      }
      latency = Date.now() - start;
    }

    const availableWeeklyMinutes = this.computeAvailableWeeklyMinutes(
      userPreferences.availableTime,
    );
    const estimatedMinutes =
      payload.estimatedWeeklyLoad?.totalMinutes ??
      (payload.tasks?.length ?? 0) * 30;
    const overload = !fallback && estimatedMinutes > availableWeeklyMinutes;
    if (overload) {
      const warning = `当前阶段每周预计 ${estimatedMinutes} 分钟，超出你设置的 ${availableWeeklyMinutes} 分钟可用时间。建议缩短计划时长或降低任务频率。`;
      payload.warnings = payload.warnings ?? [];
      if (!payload.warnings.includes(warning)) {
        payload.warnings.push(warning);
      }
    }

    await this.prisma.planVersion.update({
      where: { id: planVersion.id },
      data: {
        source: fallback ? (template ? "template" : "fallback") : "ai",
        planDuration: payload.planDuration ?? null,
        stageLength: payload.stageLength ?? null,
        currentStage: payload.currentStage ?? null,
        totalStages: payload.totalStages ?? null,
        payload: payload as any,
        userFeedback: {
          ...feedback,
          fallbackReason,
        } as any,
      },
    });

    const actualCost = this.estimateCost(
      config.model,
      usage.promptTokens,
      usage.completionTokens,
    );

    await this.prisma.aIOperation.create({
      data: {
        userId,
        model: config.model,
        promptVersion: this.promptVersion,
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        latencyMs: latency,
        cost: actualCost,
        result: {
          draftId: planVersion.id,
          source: fallback ? "fallback" : "ai",
          error: fallbackReason ?? undefined,
          dailyCostAtCall: Number(
            (costCheck.current + (actualCost ?? 0)).toFixed(6),
          ),
        } as any,
      },
    });

    subscriber.next({
      data: JSON.stringify({
        type: "draft",
        draftId: planVersion.id,
        status: "draft",
        plan: payload,
        fallback,
        error: fallbackReason ?? undefined,
        overload,
        availableWeeklyMinutes,
      }),
    });

    subscriber.next({ data: JSON.stringify({ type: "done" }) });
    subscriber.complete();
  }

  async approveDraft(userId: string, id: string, dto: ApprovePlanDto) {
    this.logger.debug(`确认计划草案: ${id}, user=${userId}`);

    const planVersion = await this.prisma.planVersion.findFirst({
      where: { id },
    });

    if (!planVersion) {
      throw new NotFoundException("计划草案不存在");
    }

    if (planVersion.approvedAt) {
      return { draftId: id, approved: false, message: "该草案已确认过" };
    }

    const confirmed = dto.confirmed ?? true;
    if (!confirmed) {
      return { draftId: id, approved: false, message: "用户未确认" };
    }

    const payload = planVersion.payload as any;

    const result = await this.executor.executeDraft(
      userId,
      payload,
      planVersion.id,
      planVersion.goalId ?? undefined,
    );

    const userFeedback =
      (planVersion.userFeedback as Record<string, unknown>) ?? {};
    if (dto.feedback) {
      userFeedback.approveFeedback = dto.feedback;
    }

    await this.prisma.planVersion.update({
      where: { id },
      data: {
        goalId: result.goalId,
        approvedAt: new Date(),
        userFeedback: userFeedback as any,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "ai.draft.approved",
      targetId: id,
      metadata: {
        goalId: result.goalId,
        projectId: result.projectId,
      },
    });

    return {
      draftId: id,
      approved: true,
      goalId: result.goalId,
      projectId: result.projectId,
      message: "计划已确认并落库",
    };
  }

  async deleteApprovedDraft(userId: string, id: string) {
    this.logger.debug(`删除已落库计划草案: ${id}, user=${userId}`);

    const planVersion = await this.prisma.planVersion.findFirst({
      where: { id },
      include: { goal: true },
    });

    if (!planVersion || !planVersion.goal || planVersion.goal.userId !== userId) {
      throw new NotFoundException("计划草案不存在或无权访问");
    }

    const goal = planVersion.goal;
    const goalId = goal.id;

    const result = await this.prisma.$transaction(async (tx) => {
      // 删除该 planVersion 及其同 goal 的所有版本
      await tx.planVersion.deleteMany({ where: { goalId } });

      // 读取该 goal 下的里程碑与项目
      const milestones = await tx.milestone.findMany({
        where: { goalId },
        select: { id: true },
      });
      const milestoneIds = milestones.map((m) => m.id);

      const projects = await tx.project.findMany({
        where: { goalId },
        select: { id: true },
      });
      const projectIds = projects.map((p) => p.id);

      // 读取项目下的任务
      const tasks = await tx.task.findMany({
        where: {
          OR: [
            { projectId: { in: projectIds } },
            { milestoneId: { in: milestoneIds } },
          ],
        },
        select: { id: true },
      });
      const taskIds = tasks.map((t) => t.id);

      // 读取与该 goal 关联的习惯
      const habitLinks = await tx.goalHabitLink.findMany({
        where: { goalId },
        select: { habitId: true },
      });
      const habitIds = habitLinks.map((h) => h.habitId);

      // 删除关联的日历事件、打卡、提醒
      await tx.calendarEvent.deleteMany({
        where: { taskId: { in: taskIds } },
      });
      await tx.checkin.deleteMany({
        where: {
          OR: [
            { taskId: { in: taskIds } },
            { habitId: { in: habitIds } },
          ],
        },
      });
      await tx.reminder.deleteMany({
        where: {
          OR: [
            { targetType: "goal", targetId: goalId },
            { targetType: "task", targetId: { in: taskIds } },
            { targetType: "habit", targetId: { in: habitIds } },
          ],
        },
      });

      // 删除任务、项目、里程碑、习惯、目标
      await tx.task.deleteMany({
        where: {
          OR: [
            { projectId: { in: projectIds } },
            { milestoneId: { in: milestoneIds } },
          ],
        },
      });
      await tx.project.deleteMany({ where: { goalId } });
      await tx.milestone.deleteMany({ where: { goalId } });
      await tx.habit.deleteMany({ where: { id: { in: habitIds } } });
      await tx.goal.delete({ where: { id: goalId } });

      return { taskIds, habitIds, projectIds, milestoneIds, goalId };
    });

    // 广播同步删除事件，便于多端刷新
    await this.syncEvents.createEvent(userId, {
      eventType: "goal.deleted",
      targetType: "goal",
      targetId: result.goalId,
      payload: { source: "ai.draft.delete" },
    });
    for (const taskId of result.taskIds) {
      await this.syncEvents.createEvent(userId, {
        eventType: "task.deleted",
        targetType: "task",
        targetId: taskId,
        payload: { source: "ai.draft.delete" },
      });
    }
    for (const habitId of result.habitIds) {
      await this.syncEvents.createEvent(userId, {
        eventType: "habit.deleted",
        targetType: "habit",
        targetId: habitId,
        payload: { source: "ai.draft.delete" },
      });
    }

    void this.analytics.track({
      userId,
      eventType: "ai.draft.deleted",
      targetId: id,
      metadata: {
        goalId: result.goalId,
        taskCount: result.taskIds.length,
        habitCount: result.habitIds.length,
      },
    });

    return {
      draftId: id,
      deleted: true,
      goalId: result.goalId,
      taskCount: result.taskIds.length,
      habitCount: result.habitIds.length,
      message: "计划及其数据已删除",
    };
  }

  async advanceDraft(userId: string, id: string) {
    this.logger.debug(`推进计划阶段: ${id}, user=${userId}`);

    const planVersion = await this.prisma.planVersion.findFirst({
      where: { id },
    });

    if (!planVersion) {
      throw new NotFoundException("计划草案不存在");
    }

    const previousPayload = planVersion.payload as any;
    const nextStage = (previousPayload.currentStage ?? 1) + 1;
    const totalStages = previousPayload.totalStages ?? 1;

    if (nextStage > totalStages) {
      return {
        draftId: id,
        status: "no_advance",
        message: "已到达最后阶段",
      };
    }

    const latestVersion = await this.prisma.planVersion.findFirst({
      where: planVersion.goalId ? { goalId: planVersion.goalId } : {},
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    const versionNo = (latestVersion?.versionNo ?? 0) + 1;

    const constraints = {
      planDuration: previousPayload.planDuration,
      stageLength: previousPayload.stageLength,
      currentStage: nextStage,
    };

    const model = this.resolveModel("cheap");
    const config = this.modelAdapter.getConfig(model);
    const costCheck = await this.checkDailyCostLimit(userId, model);

    let generation: {
      draft: any;
      fallback: boolean;
      error?: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };
    let latency = 0;

    if (costCheck.exceeded) {
      const fallbackReason = `日费用上限已触发（当前 $${costCheck.current.toFixed(4)} / $${costCheck.limit.toFixed(2)} USD），已降级为占位草案`;
      this.logger.warn(fallbackReason);
      generation = {
        draft: this.orchestrator.buildFallbackDraft(
          previousPayload.goal?.title ?? "",
          constraints,
        ),
        fallback: true,
        error: fallbackReason,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    } else {
      const start = Date.now();
      generation = await this.orchestrator.advanceStage(
        previousPayload.goal?.title ?? "",
        previousPayload,
        constraints,
        model,
      );
      latency = Date.now() - start;
    }

    const payload = generation.draft;
    const fallbackReason = generation.fallback
      ? (generation.error ?? "模型生成失败或校验不通过，已降级到占位草案")
      : null;

    const newPlanVersion = await this.prisma.planVersion.create({
      data: {
        goalId: planVersion.goalId ?? null,
        versionNo,
        source: "ai",
        planDuration: payload.planDuration ?? null,
        stageLength: payload.stageLength ?? null,
        currentStage: payload.currentStage ?? null,
        totalStages: payload.totalStages ?? null,
        payload: payload as any,
        userFeedback: {
          context: { previousDraftId: id, stage: nextStage },
          fallbackReason,
        } as any,
      },
    });

    const actualCost = this.estimateCost(
      config.model,
      generation.usage?.promptTokens ?? 0,
      generation.usage?.completionTokens ?? 0,
    );

    await this.prisma.aIOperation.create({
      data: {
        userId,
        model: config.model,
        promptVersion: this.promptVersion,
        inputTokens: generation.usage?.promptTokens ?? 0,
        outputTokens: generation.usage?.completionTokens ?? 0,
        latencyMs: latency,
        cost: actualCost,
        result: {
          draftId: newPlanVersion.id,
          source: generation.fallback ? "fallback" : "ai",
          error: generation.error ?? undefined,
          dailyCostAtCall: Number(
            (costCheck.current + (actualCost ?? 0)).toFixed(6),
          ),
        } as any,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "ai.draft.advanced",
      targetId: newPlanVersion.id,
      metadata: {
        previousDraftId: id,
        fallback: !!fallbackReason,
        stage: payload.currentStage,
        model: config.model,
      },
    });

    return {
      draftId: newPlanVersion.id,
      status: "draft",
      plan: payload,
      fallback: !!fallbackReason,
      error: fallbackReason ?? undefined,
      previousDraftId: id,
    };
  }

  async replan(userId: string, dto: ReplanDto) {
    this.logger.debug(`重新规划: ${JSON.stringify(dto)}, user=${userId}`);

    const goal = await this.prisma.goal.findFirst({
      where: { id: dto.goalId, userId },
      include: {
        milestones: { include: { tasks: true } },
        planVersions: { orderBy: { versionNo: "desc" }, take: 1 },
      },
    });

    if (!goal) {
      throw new NotFoundException("目标不存在");
    }

    const latestVersion = goal.planVersions[0];
    if (!latestVersion) {
      throw new NotFoundException("未找到该目标的计划版本");
    }

    const previousPayload = latestVersion.payload as any;

    const allTasks = goal.milestones.flatMap((m) => m.tasks);
    const doneTasks = allTasks.filter((t) => t.status === "done").length;
    const postponedTasks = allTasks.filter(
      (t) => t.status === "postponed",
    ).length;
    const skippedTasks = allTasks.filter((t) => t.status === "skipped").length;

    const progressContext = {
      completedStages: (previousPayload.currentStage ?? 1) - 1,
      doneTasks,
      postponedTasks,
      skippedTasks,
      feedback:
        dto.reason ?? (dto.feedback ? JSON.stringify(dto.feedback) : undefined),
    };

    const constraints = {
      planDuration: previousPayload.planDuration,
      stageLength: previousPayload.stageLength,
      currentStage: previousPayload.currentStage + 1,
    };

    const session = dto.sessionId
      ? await this.aiSession.getSession(userId, dto.sessionId)
      : await this.aiSession.getOrCreateSession(userId, "replan", dto.goalId);
    const effectiveInput = dto.followUp ?? dto.reason ?? goal.title;

    await this.aiSession.addMessage({
      sessionId: session.id,
      role: "user",
      content: effectiveInput,
      metadata: { goalId: dto.goalId, previousVersionId: latestVersion.id },
    });

    const recentMessages = await this.aiSession.getMessages(session.id, 20);
    const history = this.aiSession.toChatMessages(recentMessages);

    const model = this.resolveModel("strong");
    const config = this.modelAdapter.getConfig(model);
    const costCheck = await this.checkDailyCostLimit(userId, model);

    let generation: {
      draft: any;
      fallback: boolean;
      error?: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };
    let latency = 0;

    if (costCheck.exceeded) {
      const fallbackReason = `日费用上限已触发（当前 $${costCheck.current.toFixed(4)} / $${costCheck.limit.toFixed(2)} USD），已降级为占位草案`;
      this.logger.warn(fallbackReason);
      generation = {
        draft: this.orchestrator.buildFallbackDraft(goal.title, constraints),
        fallback: true,
        error: fallbackReason,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    } else {
      const start = Date.now();
      generation = await this.orchestrator.generateReplan(
        goal.title,
        previousPayload,
        progressContext,
        constraints,
        model,
        history,
      );
      latency = Date.now() - start;
    }

    const payload = generation.draft;
    const fallbackReason = generation.fallback
      ? (generation.error ?? "模型生成失败或校验不通过，已降级到占位草案")
      : null;

    const versionNo = (latestVersion.versionNo ?? 1) + 1;

    const newPlanVersion = await this.prisma.planVersion.create({
      data: {
        goalId: goal.id,
        versionNo,
        source: "ai",
        planDuration: payload.planDuration ?? null,
        stageLength: payload.stageLength ?? null,
        currentStage: payload.currentStage ?? null,
        totalStages: payload.totalStages ?? null,
        payload: payload as any,
        userFeedback: {
          context: { previousVersionId: latestVersion.id, reason: dto.reason },
          fallbackReason,
        } as any,
      },
    });

    const actualCost = this.estimateCost(
      config.model,
      generation.usage?.promptTokens ?? 0,
      generation.usage?.completionTokens ?? 0,
    );

    await this.prisma.aIOperation.create({
      data: {
        userId,
        model: config.model,
        promptVersion: this.promptVersion,
        inputTokens: generation.usage?.promptTokens ?? 0,
        outputTokens: generation.usage?.completionTokens ?? 0,
        latencyMs: latency,
        cost: actualCost,
        result: {
          draftId: newPlanVersion.id,
          source: generation.fallback ? "fallback" : "ai",
          error: generation.error ?? undefined,
          dailyCostAtCall: Number(
            (costCheck.current + (actualCost ?? 0)).toFixed(6),
          ),
        } as any,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "ai.replan.created",
      targetId: newPlanVersion.id,
      metadata: {
        goalId: goal.id,
        previousVersionId: latestVersion.id,
        fallback: !!fallbackReason,
        model: config.model,
      },
    });

    void this.aiSession.addMessage({
      sessionId: session.id,
      role: "assistant",
      content: JSON.stringify({
        draftId: newPlanVersion.id,
        goalTitle: payload.goal?.title,
        stageCount: payload.stages?.length,
        taskCount: payload.tasks?.length,
        fallback: !!fallbackReason,
      }),
      metadata: { planVersionId: newPlanVersion.id, fallback: !!fallbackReason },
    });

    void this.aiSession.maybeSummarize(session.id);

    return {
      draftId: newPlanVersion.id,
      status: "draft",
      plan: payload,
      fallback: !!fallbackReason,
      error: fallbackReason ?? undefined,
      previousVersionId: latestVersion.id,
      sessionId: session.id,
    };
  }

  async review(userId: string, dto: ReviewDto) {
    this.logger.debug(
      `生成复盘: goal=${dto.goalId}, period=${dto.period}, user=${userId}`,
    );

    const goal = await this.prisma.goal.findFirst({
      where: { id: dto.goalId, userId },
      include: {
        milestones: { include: { tasks: { include: { checkins: true } } } },
        goalLinks: { include: { habit: { include: { checkins: true } } } },
      },
    });

    if (!goal) {
      throw new NotFoundException("目标不存在");
    }

    const endDate = dto.endDate
      ? new Date(`${dto.endDate}T23:59:59.999Z`)
      : new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (dto.period === "weekly" ? 6 : 0));
    startDate.setHours(0, 0, 0, 0);

    const allTasks = goal.milestones.flatMap((m) => m.tasks);
    const doneTasks = allTasks.filter(
      (t) =>
        t.status === "done" &&
        t.updatedAt >= startDate &&
        t.updatedAt <= endDate,
    );
    const skippedTasks = allTasks.filter(
      (t) =>
        t.status === "skipped" &&
        t.updatedAt >= startDate &&
        t.updatedAt <= endDate,
    );
    const postponedTasks = allTasks.filter(
      (t) =>
        t.status === "postponed" &&
        t.updatedAt >= startDate &&
        t.updatedAt <= endDate,
    );

    const allHabits = goal.goalLinks.map((l) => l.habit);
    let habitCheckins = 0;
    for (const habit of allHabits) {
      habitCheckins += habit.checkins.filter(
        (c) => c.date >= startDate && c.date <= endDate,
      ).length;
    }

    const reviewContext = {
      period: dto.period as "daily" | "weekly",
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      goalTitle: goal.title,
      doneTasks: doneTasks.length,
      skippedTasks: skippedTasks.length,
      postponedTasks: postponedTasks.length,
      totalTasks: allTasks.length,
      habitCheckins,
      habitTotal: allHabits.length,
    };

    const session = dto.sessionId
      ? await this.aiSession.getSession(userId, dto.sessionId)
      : await this.aiSession.getOrCreateSession(userId, "review", dto.goalId);
    const effectiveInput = dto.followUp ?? goal.title;

    await this.aiSession.addMessage({
      sessionId: session.id,
      role: "user",
      content: effectiveInput,
      metadata: { goalId: dto.goalId, period: dto.period },
    });

    const recentMessages = await this.aiSession.getMessages(session.id, 20);
    const history = this.aiSession.toChatMessages(recentMessages);

    const model = this.resolveModel("strong");
    const config = this.modelAdapter.getConfig(model);
    const costCheck = await this.checkDailyCostLimit(userId, model);

    let generation: {
      summary: string;
      insights: string[];
      nextActions: string[];
      fallback: boolean;
      error?: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };
    let latency = 0;

    if (costCheck.exceeded) {
      const fallbackReason = `日费用上限已触发（当前 $${costCheck.current.toFixed(4)} / $${costCheck.limit.toFixed(2)} USD），已降级为占位复盘`;
      this.logger.warn(fallbackReason);
      generation = {
        ...this.orchestrator.buildPlaceholderReview(reviewContext),
        fallback: true,
        error: fallbackReason,
      };
    } else {
      const start = Date.now();
      generation = await this.orchestrator.generateReview(
        goal.title,
        reviewContext,
        model,
        history,
      );
      latency = Date.now() - start;
    }

    const fallbackReason = generation.fallback
      ? (generation.error ?? "模型生成失败或校验不通过，已降级为占位复盘")
      : null;

    const review = await this.prisma.review.create({
      data: {
        userId,
        goalId: dto.goalId,
        period: dto.period,
        startDate,
        endDate,
        summary: generation.summary,
        insights: generation.insights as any,
        nextActions: generation.nextActions as any,
      },
    });

    const actualCost = this.estimateCost(
      config.model,
      generation.usage?.promptTokens ?? 0,
      generation.usage?.completionTokens ?? 0,
    );

    await this.prisma.aIOperation.create({
      data: {
        userId,
        model: config.model,
        promptVersion: this.promptVersion,
        inputTokens: generation.usage?.promptTokens ?? 0,
        outputTokens: generation.usage?.completionTokens ?? 0,
        latencyMs: latency,
        cost: actualCost,
        result: {
          reviewId: review.id,
          source: generation.fallback ? "fallback" : "ai",
          error: generation.error ?? undefined,
          dailyCostAtCall: Number(
            (costCheck.current + (actualCost ?? 0)).toFixed(6),
          ),
        } as any,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "ai.review.created",
      targetId: review.id,
      metadata: {
        goalId: dto.goalId,
        period: dto.period,
        fallback: !!fallbackReason,
        model: config.model,
      },
    });

    void this.aiSession.addMessage({
      sessionId: session.id,
      role: "assistant",
      content: JSON.stringify({
        reviewId: review.id,
        summary: generation.summary,
        insightCount: generation.insights.length,
        nextActionCount: generation.nextActions.length,
        fallback: !!fallbackReason,
      }),
      metadata: { reviewId: review.id, fallback: !!fallbackReason },
    });

    void this.aiSession.maybeSummarize(session.id);

    return {
      reviewId: review.id,
      period: dto.period,
      startDate: reviewContext.startDate,
      endDate: reviewContext.endDate,
      summary: generation.summary,
      insights: generation.insights,
      nextActions: generation.nextActions,
      fallback: !!fallbackReason,
      error: fallbackReason ?? undefined,
      sessionId: session.id,
    };
  }

  async getUsage(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [agg, callCount] = await Promise.all([
      this.prisma.aIOperation.aggregate({
        _sum: { cost: true },
        where: {
          userId,
          createdAt: { gte: startOfDay },
        },
      }),
      this.prisma.aIOperation.count({
        where: {
          userId,
          createdAt: { gte: startOfDay },
        },
      }),
    ]);

    return {
      dailyCost: Number((agg._sum?.cost as number) ?? 0),
      dailyLimit: this.getDailyCostLimit(),
      callCount,
      currency: "USD",
    };
  }

  listTemplates() {
    return listTemplates().map(({ id, name, category, keywords }) => ({
      id,
      name,
      category,
      keywords,
    }));
  }

  async getTemplateRecommendation(
    input: string,
    userId?: string,
  ): Promise<AITemplate | undefined> {
    const hint = userId ? await this.buildUserHistoryHint(userId) : undefined;
    return recommendTemplate(input, hint);
  }

  private async recommendTemplateWithHistory(userId: string, input: string) {
    const hint = await this.buildUserHistoryHint(userId);
    return recommendTemplate(input, hint);
  }

  private async buildUserHistoryHint(userId: string): Promise<UserHistoryHint> {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      select: { title: true, status: true },
    });

    const goalTitles = goals.map((g) => g.title);
    const completedGoalTitles = goals
      .filter((g) => g.status === "completed")
      .map((g) => g.title);

    // 按关键词简单统计完成率：命中该关键词的目标中 completed 的比例。
    const completionRateByKeyword: Record<string, number> = {};
    for (const template of await Promise.resolve(listTemplates())) {
      for (const keyword of template.keywords) {
        const matched = goals.filter((g) =>
          g.title.toLowerCase().includes(keyword.toLowerCase()),
        );
        if (matched.length === 0) continue;
        const completed = matched.filter(
          (g) => g.status === "completed",
        ).length;
        completionRateByKeyword[keyword] = completed / matched.length;
      }
    }

    return {
      goalTitles,
      completedGoalTitles,
      completionRateByKeyword,
    };
  }

  private resolveModel(type: "cheap" | "strong"): string {
    const defaultModel = this.modelAdapter.getConfig().model;
    const envKey = type === "cheap" ? "AI_CHEAP_MODEL" : "AI_STRONG_MODEL";
    const configured = this.configService.get<string>(envKey);
    return configured?.trim() || defaultModel;
  }
}
