import { Injectable, Logger } from "@nestjs/common";
import { ModelAdapter, ModelConfig } from "./model-adapter.service";
import { AITemplate } from "./templates/ai-templates";

export interface PlanGoal {
  title: string;
  horizon: "long" | "medium" | "short";
  startDate?: string;
  dueDate?: string;
  successCriteria?: string[];
}

export interface PlanMilestone {
  title: string;
  dueDate?: string;
  weight: number;
}

export interface PlanTask {
  title: string;
  date?: string;
  durationMinutes?: number;
  energyLevel: "high" | "medium" | "low";
  repeatRule?: Record<string, unknown> | null;
  milestoneRef?: string;
  minimumStandard?: string;
}

export interface PlanHabit {
  title: string;
  frequency: string;
  preferredTime?: string;
  energyLevel: "high" | "medium" | "low";
  minimumStandard?: string;
}

export interface PlanStage {
  stageNo: number;
  durationDays: number;
  startDate: string;
  endDate: string;
  milestones: PlanMilestone[];
  tasks?: PlanTask[];
  isDetailed: boolean;
}

export interface PlanDraftPayload {
  goal: PlanGoal;
  planDuration: number;
  stageLength: number;
  currentStage: number;
  totalStages: number;
  stages: PlanStage[];
  milestones: PlanMilestone[];
  tasks: PlanTask[];
  habits: PlanHabit[];
  assumptions: string[];
  warnings: string[];
  estimatedWeeklyLoad: {
    totalMinutes: number;
    highEnergyMinutes: number;
  };
}

export interface DraftProgressEvent {
  type: "progress";
  stage:
    | "analyzing_input"
    | "selecting_template"
    | "generating_plan"
    | "validating_plan"
    | "fallback";
  message?: string;
}

export interface DraftResultEvent {
  type: "result";
  draft: PlanDraftPayload;
  fallback: boolean;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type DraftStreamEvent = DraftProgressEvent | DraftResultEvent;

interface PlanConstraints {
  planDuration: number;
  stageLength: number;
  currentStage: number;
  userPreferences?: Record<string, unknown>;
}

/**
 * 计划编排层
 * 负责选择模板、组装提示词、调用模型、校验 Schema 与生成变更 diff。
 */
@Injectable()
export class PlanOrchestrator {
  private readonly logger = new Logger(PlanOrchestrator.name);

  constructor(private readonly modelAdapter: ModelAdapter) {}

  /**
   * 根据用户输入生成计划草案。
   * 优先调用真实模型；若模型未配置、调用失败或返回不合法，则降级到占位草案。
   */
  async generateDraft(
    userInput: string,
    constraints?: Record<string, unknown>,
    template?: AITemplate,
    modelName?: string,
    history?: { role: "system" | "user" | "assistant"; content: string }[],
    config?: ModelConfig,
  ): Promise<{
    draft: PlanDraftPayload;
    fallback: boolean;
    error?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    this.logger.debug(
      `编排计划草案，输入: ${userInput}, 约束: ${JSON.stringify(constraints)}, 模板: ${template?.id ?? "无"}, 模型: ${modelName ?? "默认"}`,
    );

    const planConstraints = this.normalizeConstraints(constraints);

    const resolvedConfig = this.modelAdapter.getConfig(modelName);
    if (!resolvedConfig.enabled) {
      this.logger.warn(`AI 模型未启用，使用占位草案`);
      return {
        draft: template
          ? this.buildTemplateFallbackDraft(template, planConstraints)
          : this.buildPlaceholderDraft(userInput, planConstraints),
        fallback: true,
        error: "AI 模型未配置",
      };
    }

    const prompt = this.buildPrompt(userInput, planConstraints, template);
    const schema = this.getPlanSchema(planConstraints);

    const response =
      await this.modelAdapter.generateStructured<PlanDraftPayload>(
        prompt,
        schema,
        { modelName, history, config },
      );

    if (response.error || !response.data) {
      const reason = response.error ?? "返回数据为空";
      this.logger.warn(`模型生成失败: ${reason}，降级到占位草案`);
      return {
        draft: template
          ? this.buildTemplateFallbackDraft(template, planConstraints)
          : this.buildPlaceholderDraft(userInput, planConstraints),
        fallback: true,
        error: reason,
        usage: response.usage,
      };
    }

    const normalized = this.normalizeDraft(response.data, planConstraints);
    if (!normalized) {
      this.logger.warn(`模型输出校验失败，降级到占位草案`);
      return {
        draft: template
          ? this.buildTemplateFallbackDraft(template, planConstraints)
          : this.buildPlaceholderDraft(userInput, planConstraints),
        fallback: true,
        error: "模型输出校验失败",
        usage: response.usage,
      };
    }

    this.logger.debug(`模型生成计划草案成功`);
    return { draft: normalized, fallback: false, usage: response.usage };
  }

  /**
   * 根据上传的计划文件内容生成计划草案。
   * 支持 master（总/月计划）和 weekly（周/日计划）两种 scope。
   */
  async generateDraftFromFile(
    fileContent: string,
    constraints?: Record<string, unknown>,
    scope: "master" | "weekly" = "master",
    parentGoalTitle?: string,
    modelName?: string,
    config?: ModelConfig,
  ): Promise<{
    draft: PlanDraftPayload;
    fallback: boolean;
    error?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    this.logger.debug(
      `编排文件导入计划草案，scope: ${scope}, 父目标: ${parentGoalTitle ?? "无"}, 模型: ${modelName ?? "默认"}`,
    );

    const planConstraints = this.normalizeConstraints(constraints);

    const resolvedConfig = this.modelAdapter.getConfig(modelName);
    const effectiveConfig = config ?? resolvedConfig;
    if (!effectiveConfig.enabled) {
      this.logger.warn(`AI 模型未启用，使用占位草案`);
      return {
        draft: this.buildFileFallbackDraft(fileContent, planConstraints, scope, parentGoalTitle),
        fallback: true,
        error: "AI 模型未配置",
      };
    }

    const prompt = this.buildFileImportPrompt(
      fileContent,
      planConstraints,
      scope,
      parentGoalTitle,
    );
    const schema = this.getPlanSchema(planConstraints);

    const response =
      await this.modelAdapter.generateStructured<PlanDraftPayload>(
        prompt,
        schema,
        { modelName, config },
      );

    if (response.error || !response.data) {
      const reason = response.error ?? "返回数据为空";
      this.logger.warn(`文件解析模型生成失败: ${reason}，降级到占位草案`);
      return {
        draft: this.buildFileFallbackDraft(fileContent, planConstraints, scope, parentGoalTitle),
        fallback: true,
        error: reason,
        usage: response.usage,
      };
    }

    const normalized = this.normalizeDraft(response.data, planConstraints);
    if (!normalized) {
      this.logger.warn(`文件解析模型输出校验失败，降级到占位草案`);
      return {
        draft: this.buildFileFallbackDraft(fileContent, planConstraints, scope, parentGoalTitle),
        fallback: true,
        error: "模型输出校验失败",
        usage: response.usage,
      };
    }

    this.logger.debug(`文件解析模型生成计划草案成功`);
    return { draft: normalized, fallback: false, usage: response.usage };
  }

  /**
   * 流式生成计划草案。
   * 复用 generateDraft 的提示词、校验与降级逻辑，在关键阶段产出 progress 事件，
   * 最后产出 result 事件。
   */
  async *generateDraftStream(
    userInput: string,
    constraints?: Record<string, unknown>,
    template?: AITemplate,
    modelName?: string,
    config?: ModelConfig,
  ): AsyncGenerator<DraftStreamEvent> {
    this.logger.debug(
      `编排流式计划草案，输入: ${userInput}, 模板: ${template?.id ?? "无"}, 模型: ${modelName ?? "默认"}`,
    );

    yield {
      type: "progress",
      stage: "analyzing_input",
      message: "正在分析你的目标…",
    };

    const planConstraints = this.normalizeConstraints(constraints);

    yield {
      type: "progress",
      stage: "selecting_template",
      message: template
        ? `已选择模板「${template.name}」`
        : "正在匹配推荐模板…",
    };

    const resolvedConfig = this.modelAdapter.getConfig(modelName);
    if (!resolvedConfig.enabled) {
      yield {
        type: "progress",
        stage: "fallback",
        message: "AI 模型未配置，使用占位草案",
      };
      yield {
        type: "result",
        draft: template
          ? this.buildTemplateFallbackDraft(template, planConstraints)
          : this.buildPlaceholderDraft(userInput, planConstraints),
        fallback: true,
        error: "AI 模型未配置",
      };
      return;
    }

    yield {
      type: "progress",
      stage: "generating_plan",
      message: "正在生成计划草案，请稍候…",
    };

    const prompt = this.buildPrompt(userInput, planConstraints, template);
    const schema = this.getPlanSchema(planConstraints);

    let response:
      | import("./model-adapter.service").StructuredResponse<PlanDraftPayload>
      | undefined;
    for await (const event of this.modelAdapter.streamProgress<PlanDraftPayload>(
      prompt,
      schema,
      { modelName, config },
    )) {
      if (event.type === "result") {
        response = event.response;
      }
    }

    if (!response || response.error || !response.data) {
      const reason = response?.error ?? "模型未返回结果";
      this.logger.warn(`模型生成失败: ${reason}，降级到占位草案`);
      yield {
        type: "progress",
        stage: "fallback",
        message: `生成失败：${reason}，已降级`,
      };
      yield {
        type: "result",
        draft: template
          ? this.buildTemplateFallbackDraft(template, planConstraints)
          : this.buildPlaceholderDraft(userInput, planConstraints),
        fallback: true,
        error: reason,
        usage: response?.usage,
      };
      return;
    }

    yield {
      type: "progress",
      stage: "validating_plan",
      message: "正在校验并格式化计划…",
    };

    const normalized = this.normalizeDraft(response.data, planConstraints);
    if (!normalized) {
      yield {
        type: "progress",
        stage: "fallback",
        message: "模型输出校验失败，已降级",
      };
      yield {
        type: "result",
        draft: template
          ? this.buildTemplateFallbackDraft(template, planConstraints)
          : this.buildPlaceholderDraft(userInput, planConstraints),
        fallback: true,
        error: "模型输出校验失败",
        usage: response.usage,
      };
      return;
    }

    yield {
      type: "result",
      draft: normalized,
      fallback: false,
      usage: response.usage,
    };
  }

  /**
   * 基于已有 PlanVersion 的 payload 生成下一个阶段的详细任务。
   * 用于 /advance 接口。
   */
  async advanceStage(
    userInput: string,
    previousPayload: PlanDraftPayload,
    constraints?: Record<string, unknown>,
    modelName?: string,
    config?: ModelConfig,
  ): Promise<{
    draft: PlanDraftPayload;
    fallback: boolean;
    error?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    const nextStage = previousPayload.currentStage + 1;
    if (nextStage > previousPayload.totalStages) {
      return {
        draft: previousPayload,
        fallback: true,
        error: "已到达最后阶段",
      };
    }

    const planConstraints = this.normalizeConstraints(constraints, {
      planDuration: previousPayload.planDuration,
      stageLength: previousPayload.stageLength,
      currentStage: nextStage,
    });

    const resolvedConfig = this.modelAdapter.getConfig(modelName);
    if (!resolvedConfig.enabled) {
      return {
        draft: this.advancePlaceholder(previousPayload, planConstraints),
        fallback: true,
        error: "AI 模型未配置",
      };
    }

    const prompt = this.buildAdvancePrompt(
      userInput,
      previousPayload,
      planConstraints,
    );
    const schema = this.getStageSchema(planConstraints);

    const response = await this.modelAdapter.generateStructured<{
      stage: PlanStage;
      assumptions?: string[];
      warnings?: string[];
    }>(prompt, schema, { modelName, config });

    if (response.error || !response.data) {
      return {
        draft: this.advancePlaceholder(previousPayload, planConstraints),
        fallback: true,
        error: response.error ?? "返回数据为空",
        usage: response.usage,
      };
    }

    const newStage = response.data.stage;
    if (!this.validateStage(newStage, planConstraints)) {
      return {
        draft: this.advancePlaceholder(previousPayload, planConstraints),
        fallback: true,
        error: "阶段输出校验失败",
        usage: response.usage,
      };
    }

    const updatedStages = previousPayload.stages.map((s) =>
      s.stageNo === newStage.stageNo ? { ...newStage, isDetailed: true } : s,
    );

    const updatedPayload: PlanDraftPayload = {
      ...previousPayload,
      currentStage: nextStage,
      stages: updatedStages,
      milestones: updatedStages.flatMap((s) => s.milestones),
      tasks: newStage.tasks ?? [],
      assumptions: response.data.assumptions ?? previousPayload.assumptions,
      warnings: response.data.warnings ?? previousPayload.warnings,
    };

    return { draft: updatedPayload, fallback: false, usage: response.usage };
  }

  /**
   * 生成复盘摘要。
   */
  async generateReview(
    input: string,
    context: {
      period: "daily" | "weekly";
      startDate: string;
      endDate: string;
      goalTitle: string;
      doneTasks: number;
      skippedTasks: number;
      postponedTasks: number;
      totalTasks: number;
      habitCheckins: number;
      habitTotal: number;
    },
    modelName?: string,
    history?: { role: "system" | "user" | "assistant"; content: string }[],
    config?: ModelConfig,
  ): Promise<{
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
  }> {
    this.logger.debug(
      `生成复盘: period=${context.period}, goal=${context.goalTitle}`,
    );

    const resolvedConfig = this.modelAdapter.getConfig(modelName);
    if (!resolvedConfig.enabled) {
      return {
        ...this.buildPlaceholderReview(context),
        fallback: true,
        error: "AI 模型未配置",
      };
    }

    const prompt = this.buildReviewPrompt(input, context, history);
    const schema = this.getReviewSchema();

    const response = await this.modelAdapter.generateStructured<{
      summary: string;
      insights: string[];
      nextActions: string[];
    }>(prompt, schema, { modelName, config });

    if (response.error || !response.data) {
      return {
        ...this.buildPlaceholderReview(context),
        fallback: true,
        error: response.error ?? "返回数据为空",
        usage: response.usage,
      };
    }

    const data = response.data;
    if (
      !data.summary ||
      !Array.isArray(data.insights) ||
      !Array.isArray(data.nextActions)
    ) {
      return {
        ...this.buildPlaceholderReview(context),
        fallback: true,
        error: "模型输出校验失败",
        usage: response.usage,
      };
    }

    return {
      summary: data.summary,
      insights: data.insights.slice(0, 5),
      nextActions: data.nextActions.slice(0, 5),
      fallback: false,
      usage: response.usage,
    };
  }

  public buildPlaceholderReview(context: {
    period: "daily" | "weekly";
    doneTasks: number;
    totalTasks: number;
    habitCheckins: number;
  }) {
    const periodText = context.period === "weekly" ? "周" : "日";
    return {
      summary: `本${periodText}共完成任务 ${context.doneTasks}/${context.totalTasks} 个，习惯打卡 ${context.habitCheckins} 次。`,
      insights: ["任务完成率稳定", "继续保持当前节奏"],
      nextActions: ["完成剩余任务", "根据进度调整下周计划"],
    };
  }

  private buildReviewPrompt(
    input: string,
    context: {
      period: "daily" | "weekly";
      startDate: string;
      endDate: string;
      goalTitle: string;
      doneTasks: number;
      skippedTasks: number;
      postponedTasks: number;
      totalTasks: number;
      habitCheckins: number;
      habitTotal: number;
    },
    history?: { role: "system" | "user" | "assistant"; content: string }[],
  ): string {
    const periodText = context.period === "weekly" ? "周" : "日";
    const historyText = history?.length
      ? `\n此前对话上下文（按时间顺序）：\n${history.map((m) => `${m.role === "user" ? "用户" : "AI"}：${m.content}`).join("\n")}\n`
      : "";
    return `你是一位专业的目标复盘教练。请根据以下数据生成一段${periodText}复盘。

目标：${context.goalTitle}
用户输入：${input}${historyText}
统计周期：${context.startDate} 至 ${context.endDate}

数据：
- 任务：完成 ${context.doneTasks}/${context.totalTasks} 个，跳过 ${context.skippedTasks} 个，延期 ${context.postponedTasks} 个
- 习惯：打卡 ${context.habitCheckins}/${context.habitTotal} 次

要求：
1. summary：一段 80 字以内的总结，客观、鼓励性。
2. insights：2-5 条洞察，指出做得好的地方和潜在风险。
3. nextActions：2-5 条具体可执行的下一步建议。
4. 只输出 JSON，不要额外解释。`;
  }

  private getReviewSchema(): object {
    return {
      type: "object",
      properties: {
        summary: { type: "string" },
        insights: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: { type: "string" },
        },
        nextActions: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: { type: "string" },
        },
      },
      required: ["summary", "insights", "nextActions"],
    };
  }

  /**
   * 基于已有计划与执行进度，重新生成后续阶段的计划草案。
   */
  async generateReplan(
    userInput: string,
    previousPayload: PlanDraftPayload,
    progressContext: {
      completedStages: number;
      doneTasks: number;
      postponedTasks: number;
      skippedTasks: number;
      feedback?: string;
    },
    constraints?: Record<string, unknown>,
    modelName?: string,
    history?: { role: "system" | "user" | "assistant"; content: string }[],
    config?: ModelConfig,
  ): Promise<{
    draft: PlanDraftPayload;
    fallback: boolean;
    error?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    const nextStage = previousPayload.currentStage + 1;
    if (nextStage > previousPayload.totalStages) {
      return {
        draft: previousPayload,
        fallback: true,
        error: "已到达最后阶段，无需重新规划",
      };
    }

    const planConstraints = this.normalizeConstraints(constraints, {
      planDuration: previousPayload.planDuration,
      stageLength: previousPayload.stageLength,
      currentStage: nextStage,
    });

    const resolvedConfig = this.modelAdapter.getConfig(modelName);
    if (!resolvedConfig.enabled) {
      return {
        draft: this.advancePlaceholder(previousPayload, planConstraints),
        fallback: true,
        error: "AI 模型未配置",
      };
    }

    const prompt = this.buildReplanPrompt(
      userInput,
      previousPayload,
      progressContext,
      planConstraints,
      history,
    );
    const schema = this.getPlanSchema(planConstraints);

    const response =
      await this.modelAdapter.generateStructured<PlanDraftPayload>(
        prompt,
        schema,
        { modelName, config },
      );

    if (response.error || !response.data) {
      return {
        draft: this.advancePlaceholder(previousPayload, planConstraints),
        fallback: true,
        error: response.error ?? "返回数据为空",
        usage: response.usage,
      };
    }

    const normalized = this.normalizeDraft(response.data, planConstraints);
    if (!normalized) {
      return {
        draft: this.advancePlaceholder(previousPayload, planConstraints),
        fallback: true,
        error: "模型输出校验失败",
        usage: response.usage,
      };
    }

    return { draft: normalized, fallback: false, usage: response.usage };
  }

  private buildReplanPrompt(
    userInput: string,
    previousPayload: PlanDraftPayload,
    progressContext: {
      completedStages: number;
      doneTasks: number;
      postponedTasks: number;
      skippedTasks: number;
      feedback?: string;
    },
    constraints: PlanConstraints,
    history?: { role: "system" | "user" | "assistant"; content: string }[],
  ): string {
    const stageDates = this.computeStageDates(
      previousPayload.goal.startDate ?? new Date().toISOString().split("T")[0],
      constraints.stageLength,
      constraints.currentStage,
      constraints.planDuration,
    );

    const previousStagesSummary = previousPayload.stages
      .filter((s) => s.isDetailed)
      .map(
        (s) =>
          `阶段 ${s.stageNo}（${s.startDate} 至 ${s.endDate}）：${s.tasks?.map((t) => t.title).join("、") ?? ""}`,
      )
      .join("\n");

    const historyText = history?.length
      ? `\n此前对话上下文（按时间顺序）：\n${history.map((m) => `${m.role === "user" ? "用户" : "AI"}：${m.content}`).join("\n")}\n`
      : "";

    return `用户目标：${userInput}${historyText}

原始计划：
- 总时长：${previousPayload.planDuration} 天
- 每阶段：${previousPayload.stageLength} 天
- 当前阶段：第 ${constraints.currentStage} / ${previousPayload.totalStages} 阶段
- 阶段日期：${stageDates.startDate} 至 ${stageDates.endDate}

已执行阶段：
${previousStagesSummary || "无"}

执行统计：
- 已完成阶段数：${progressContext.completedStages}
- 已完成任务：${progressContext.doneTasks}
- 延期任务：${progressContext.postponedTasks}
- 跳过任务：${progressContext.skippedTasks}
- 用户反馈：${progressContext.feedback ?? "无"}

请基于以上信息重新生成第 ${constraints.currentStage} 阶段的详细任务：
1. 承接已执行阶段，不要重复已完成任务。
2. 根据延期/跳过情况调整任务节奏。
3. 每天一个具体可执行任务，包含 title、date、durationMinutes、energyLevel、milestoneRef、minimumStandard。
4. 输出结构与生成计划草案一致，stages 数组中仅当前阶段 isDetailed=true。`;
  }

  private normalizeConstraints(
    raw?: Record<string, unknown>,
    defaults?: Partial<PlanConstraints>,
  ): PlanConstraints {
    const planDuration =
      (raw?.["planDuration"] as number) ?? defaults?.planDuration ?? 7;
    const stageLength =
      (raw?.["stageLength"] as number) ?? defaults?.stageLength ?? 7;
    const currentStage =
      (raw?.["currentStage"] as number) ?? defaults?.currentStage ?? 1;

    return {
      planDuration: Math.max(7, Math.min(365, planDuration)),
      stageLength: Math.max(7, Math.min(30, stageLength)),
      currentStage: Math.max(1, currentStage),
      userPreferences:
        (raw?.["userPreferences"] as Record<string, unknown>) ?? {},
    };
  }

  private computeStageCount(planDuration: number, stageLength: number): number {
    return Math.ceil(planDuration / stageLength);
  }

  private computeStageDates(
    startDate: string,
    stageLength: number,
    stageNo: number,
    planDuration: number,
  ): { startDate: string; endDate: string; durationDays: number } {
    const stageStart = this.addDays(startDate, (stageNo - 1) * stageLength);
    const rawEnd = this.addDays(stageStart, stageLength - 1);
    const planEnd = this.addDays(startDate, planDuration - 1);
    const endDate = rawEnd < planEnd ? rawEnd : planEnd;
    const durationDays = this.daysBetween(stageStart, endDate) + 1;
    return { startDate: stageStart, endDate, durationDays };
  }

  private buildPrompt(
    userInput: string,
    constraints: PlanConstraints,
    template?: AITemplate,
  ): string {
    const today = new Date().toISOString().split("T")[0];
    const planEnd = this.addDays(today, constraints.planDuration - 1);
    const totalStages = this.computeStageCount(
      constraints.planDuration,
      constraints.stageLength,
    );
    const stageDates = this.computeStageDates(
      today,
      constraints.stageLength,
      constraints.currentStage,
      constraints.planDuration,
    );

    const userPrefs = constraints.userPreferences ?? {};
    const templateContext = template
      ? `\n该计划属于「${template.name}」模板。\n${template.basePrompt}\n`
      : "";

    return `请为用户制定一个长期目标的行动计划，采用分阶段展开方式。${templateContext}

用户目标：${userInput}

总计划信息：
- 总时长：${constraints.planDuration} 天
- 起止日期：${today} 至 ${planEnd}
- 每阶段长度：${constraints.stageLength} 天
- 总阶段数：${totalStages}
- 当前阶段：第 ${constraints.currentStage} 阶段
- 当前阶段日期：${stageDates.startDate} 至 ${stageDates.endDate}

用户上下文：
${JSON.stringify(
  {
    timezone: userPrefs["timezone"] ?? "Asia/Shanghai",
    availableTime: userPrefs["availableTime"] ?? "未配置",
    energyCurve: userPrefs["energyCurve"] ?? "未配置",
  },
  null,
  2,
)}\n
要求：
1. 目标（goal）要有 title、horizon（根据总时长判断：<=30 天 short，<=90 天 medium，>90 天 long）、startDate（${today}）、dueDate（${planEnd}）、successCriteria（2-3 条）。
2. 为每个阶段生成一个里程碑（milestones），每个里程碑有 title、dueDate（阶段结束日期）、weight（权重，按阶段重要性分配，总和为 1）。
3. 只对当前阶段（第 ${constraints.currentStage} 阶段）生成详细任务（tasks），每天一个任务，每个任务有 title、date、durationMinutes（15-120 分钟）、energyLevel（high/medium/low）、milestoneRef（m1/m2/...，对应阶段编号）、minimumStandard（最低完成标准）。
4. 其他阶段不要生成 tasks，只保留里程碑和 isDetailed=false。
5. 生成 1-2 个习惯（habits），贯穿整个计划，有 title、frequency（daily/weekly/weekdays）、preferredTime（HH:MM）、energyLevel、minimumStandard。
6. 列出 assumptions（2-3 条）和 warnings（2-3 条）。
7. 给出 estimatedWeeklyLoad：totalMinutes（当前阶段每周预计分钟数）、highEnergyMinutes（高精力任务分钟数）。
8. 输出结构必须包含 stages 数组，每个 stage 有 stageNo、durationDays、startDate、endDate、milestones、tasks（仅当前阶段）、isDetailed。`;
  }

  private buildAdvancePrompt(
    userInput: string,
    previousPayload: PlanDraftPayload,
    constraints: PlanConstraints,
  ): string {
    const stageDates = this.computeStageDates(
      previousPayload.goal.startDate ?? new Date().toISOString().split("T")[0],
      constraints.stageLength,
      constraints.currentStage,
      constraints.planDuration,
    );

    const previousStagesSummary = previousPayload.stages
      .filter((s) => s.isDetailed)
      .map(
        (s) =>
          `阶段 ${s.stageNo}（${s.startDate} 至 ${s.endDate}）：${s.tasks?.map((t) => t.title).join("、") ?? ""}`,
      )
      .join("\n");

    return `用户目标：${userInput}

这是长期计划的第 ${constraints.currentStage} / ${previousPayload.totalStages} 阶段。

已执行阶段总结：
${previousStagesSummary || "无"}

请为第 ${constraints.currentStage} 阶段生成详细任务：
- 阶段日期：${stageDates.startDate} 至 ${stageDates.endDate}
- 每天一个具体可执行任务
- 每个任务包含 title、date、durationMinutes（15-120）、energyLevel（high/medium/low）、milestoneRef（m${constraints.currentStage}）、minimumStandard
- 任务要与整体目标一致，承接已执行阶段

只返回当前阶段的 stage 对象。`;
  }

  private buildFileImportPrompt(
    fileContent: string,
    constraints: PlanConstraints,
    scope: "master" | "weekly",
    parentGoalTitle?: string,
  ): string {
    const today = new Date().toISOString().split("T")[0];
    const planDuration = constraints.planDuration || 30;
    const stageLength = constraints.stageLength || 7;
    const planEnd = this.addDays(today, planDuration - 1);
    const totalStages = this.computeStageCount(planDuration, stageLength);

    if (scope === "weekly") {
      return `你是一位严格的计划执行助手。请根据以下周/日计划文件内容，提取出具体可执行的任务列表，输出为严格 JSON。

${parentGoalTitle ? `该计划属于已有目标：${parentGoalTitle}` : ""}

文件内容：
---
${fileContent}
---

要求：
1. 从文件中识别每一天的安排，生成 tasks。每个任务包含 title、date（YYYY-MM-DD，必须根据文件中的星期/日期推断，若未明确则按从今天 ${today} 开始的顺序推算）、durationMinutes（默认 30-120）、energyLevel（high/medium/low，根据任务性质判断）、milestoneRef（统一填 m1）、minimumStandard（最低完成标准）。
2. 如果文件提到习惯（如"每天背单词""早读"），生成 habits，包含 title、frequency（daily/weekly/weekdays）、preferredTime（HH:MM 或空）、energyLevel、minimumStandard。
3. 生成一个与已有目标一致的 goal.title（${parentGoalTitle ?? "从文件中提取目标名称"}），horizon 填 short，startDate ${today}，dueDate ${planEnd}。
4. planDuration 填 ${planDuration}，stageLength 填 ${stageLength}，currentStage 填 1，totalStages 填 1。
5. stages 只包含一个阶段（stageNo=1, 起始 ${today}, 结束 ${planEnd}, isDetailed=true），其 tasks 与顶层 tasks 一致。
6. milestones 生成 1 个总里程碑：{ title: "完成周计划", dueDate: "${planEnd}", weight: 1 }。
7. assumptions 和 warnings 各 1-2 条。
8. 未在文件中明确提到的内容不要编造，若文件内容不完整可返回空数组。

请只输出 JSON。`;
    }

    return `你是一位严格的长期计划教练。请根据以下计划文件内容，提取出一个长期目标、阶段里程碑和相关习惯，输出为严格 JSON。

文件内容：
---
${fileContent}
---

要求：
1. 从文件中提取总体目标作为 goal.title；根据计划总时长判断 horizon（<=30 天 short，<=90 天 medium，>90 天 long）；startDate 为 ${today}；dueDate 根据文件推断，无法推断则填 ${planEnd}；successCriteria 提取 2-3 条。
2. 根据文件中的阶段/月份/轮次生成 milestones（每个包含 title、dueDate、weight，权重总和为 1）。
3. 如果当前阶段（第 1 阶段）有详细任务，生成 tasks（每个包含 title、date、durationMinutes、energyLevel、milestoneRef=m1/m2...、minimumStandard）。
4. 如果文件提到需要日常坚持的行为，生成 habits（1-2 个）。
5. planDuration 填 ${planDuration}，stageLength 填 ${stageLength}，currentStage 填 1，totalStages 填 ${totalStages}。
6. stages 数组：每个阶段包含 stageNo、durationDays、startDate、endDate、milestones、tasks（仅当前阶段 isDetailed=true，其余 isDetailed=false）。
7. assumptions 和 warnings 各 2-3 条。
8. 未在文件中明确提到的内容不要编造。

请只输出 JSON。`;
  }

  private getPlanSchema(constraints: PlanConstraints): object {
    const totalStages = this.computeStageCount(
      constraints.planDuration,
      constraints.stageLength,
    );
    const currentStage = constraints.currentStage;
    const currentStageDays = this.computeStageDates(
      new Date().toISOString().split("T")[0],
      constraints.stageLength,
      currentStage,
      constraints.planDuration,
    ).durationDays;

    return {
      type: "object",
      properties: {
        goal: {
          type: "object",
          properties: {
            title: { type: "string" },
            horizon: { type: "string", enum: ["long", "medium", "short"] },
            startDate: { type: "string" },
            dueDate: { type: "string" },
            successCriteria: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 3,
            },
          },
          required: [
            "title",
            "horizon",
            "startDate",
            "dueDate",
            "successCriteria",
          ],
        },
        planDuration: { type: "number" },
        stageLength: { type: "number" },
        currentStage: { type: "number" },
        totalStages: { type: "number" },
        stages: {
          type: "array",
          minItems: totalStages,
          maxItems: totalStages,
          items: {
            type: "object",
            properties: {
              stageNo: { type: "number" },
              durationDays: { type: "number" },
              startDate: { type: "string" },
              endDate: { type: "string" },
              milestones: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    dueDate: { type: "string" },
                    weight: { type: "number" },
                  },
                  required: ["title", "weight"],
                },
              },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    date: { type: "string" },
                    durationMinutes: { type: "number" },
                    energyLevel: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                    },
                    milestoneRef: { type: "string" },
                    minimumStandard: { type: "string" },
                  },
                  required: ["title", "date", "energyLevel", "milestoneRef"],
                },
              },
              isDetailed: { type: "boolean" },
            },
            required: [
              "stageNo",
              "durationDays",
              "startDate",
              "endDate",
              "milestones",
              "isDetailed",
            ],
          },
        },
        milestones: { type: "array", items: { type: "object" } },
        tasks: {
          type: "array",
          minItems: currentStage === totalStages ? 1 : currentStageDays,
          maxItems: currentStageDays + 1,
          items: { type: "object" },
        },
        habits: {
          type: "array",
          minItems: 1,
          maxItems: 2,
          items: { type: "object" },
        },
        assumptions: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        estimatedWeeklyLoad: {
          type: "object",
          properties: {
            totalMinutes: { type: "number" },
            highEnergyMinutes: { type: "number" },
          },
          required: ["totalMinutes", "highEnergyMinutes"],
        },
      },
      required: [
        "goal",
        "planDuration",
        "stageLength",
        "currentStage",
        "totalStages",
        "stages",
        "milestones",
        "tasks",
        "habits",
        "assumptions",
        "warnings",
        "estimatedWeeklyLoad",
      ],
    };
  }

  private getStageSchema(_constraints: PlanConstraints): object {
    return {
      type: "object",
      properties: {
        stage: {
          type: "object",
          properties: {
            stageNo: { type: "number" },
            durationDays: { type: "number" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            milestones: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  dueDate: { type: "string" },
                  weight: { type: "number" },
                },
                required: ["title", "weight"],
              },
            },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  date: { type: "string" },
                  durationMinutes: { type: "number" },
                  energyLevel: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                  },
                  milestoneRef: { type: "string" },
                  minimumStandard: { type: "string" },
                },
                required: ["title", "date", "energyLevel", "milestoneRef"],
              },
            },
            isDetailed: { type: "boolean" },
          },
          required: [
            "stageNo",
            "durationDays",
            "startDate",
            "endDate",
            "milestones",
            "tasks",
            "isDetailed",
          ],
        },
        assumptions: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
      },
      required: ["stage"],
    };
  }

  private normalizeDraft(
    raw: PlanDraftPayload,
    constraints: PlanConstraints,
  ): PlanDraftPayload | null {
    if (!raw?.goal?.title || !raw?.goal?.horizon) return null;
    if (!Array.isArray(raw.stages) || raw.stages.length === 0) return null;

    const totalStages = this.computeStageCount(
      constraints.planDuration,
      constraints.stageLength,
    );

    const startDate =
      raw.goal.startDate ?? new Date().toISOString().split("T")[0];
    const planDuration = constraints.planDuration;

    const stages: PlanStage[] = [];
    for (let i = 1; i <= totalStages; i++) {
      const stageDates = this.computeStageDates(
        startDate,
        constraints.stageLength,
        i,
        planDuration,
      );
      const rawStage = raw.stages.find((s) => s.stageNo === i);
      const isDetailed = i === constraints.currentStage;
      const stageTasks = isDetailed ? (rawStage?.tasks ?? []) : [];

      stages.push({
        stageNo: i,
        durationDays: stageDates.durationDays,
        startDate: stageDates.startDate,
        endDate: stageDates.endDate,
        milestones: Array.isArray(rawStage?.milestones)
          ? rawStage.milestones.map((m) => ({
              title: m.title,
              dueDate: m.dueDate ?? stageDates.endDate,
              weight: m.weight ?? 1 / totalStages,
            }))
          : [
              {
                title: `第 ${i} 阶段`,
                dueDate: stageDates.endDate,
                weight: 1 / totalStages,
              },
            ],
        tasks: stageTasks,
        isDetailed,
      });
    }

    const currentStage = stages.find(
      (s) => s.stageNo === constraints.currentStage,
    );
    if (
      !currentStage ||
      !currentStage.tasks ||
      currentStage.tasks.length === 0
    ) {
      return null;
    }

    for (const t of currentStage.tasks) {
      if (!t.date || !t.title || !t.energyLevel) return null;
    }

    return {
      goal: {
        title: raw.goal.title,
        horizon: raw.goal.horizon,
        startDate: raw.goal.startDate,
        dueDate: raw.goal.dueDate,
        successCriteria: Array.isArray(raw.goal.successCriteria)
          ? raw.goal.successCriteria
          : [],
      },
      planDuration,
      stageLength: constraints.stageLength,
      currentStage: constraints.currentStage,
      totalStages,
      stages,
      milestones: stages.flatMap((s) => s.milestones),
      tasks: currentStage.tasks,
      habits: Array.isArray(raw.habits) ? raw.habits : [],
      assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : [],
      warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
      estimatedWeeklyLoad: raw.estimatedWeeklyLoad ?? {
        totalMinutes: 0,
        highEnergyMinutes: 0,
      },
    };
  }

  private validateStage(
    stage: PlanStage,
    constraints: PlanConstraints,
  ): boolean {
    if (stage.stageNo !== constraints.currentStage) return false;
    if (!stage.tasks || stage.tasks.length === 0) return false;
    for (const t of stage.tasks) {
      if (!t.date || !t.title || !t.energyLevel) return false;
    }
    return true;
  }

  private buildFileFallbackDraft(
    fileContent: string,
    constraints: PlanConstraints,
    scope: "master" | "weekly",
    parentGoalTitle?: string,
  ): PlanDraftPayload {
    const today = new Date().toISOString().split("T")[0];
    const title =
      parentGoalTitle ??
      fileContent.split("\n")[0]?.trim().slice(0, 30) ??
      "导入的计划";
    return this.buildPlaceholderDraft(
      `${scope === "weekly" ? "周计划" : "总计划"}：${title}`,
      constraints,
    );
  }

  private buildPlaceholderDraft(
    userInput: string,
    constraints: PlanConstraints,
  ): PlanDraftPayload {
    const today = new Date().toISOString().split("T")[0];
    const totalStages = this.computeStageCount(
      constraints.planDuration,
      constraints.stageLength,
    );
    const planEnd = this.addDays(today, constraints.planDuration - 1);

    const stages: PlanStage[] = [];
    for (let i = 1; i <= totalStages; i++) {
      const stageDates = this.computeStageDates(
        today,
        constraints.stageLength,
        i,
        constraints.planDuration,
      );
      const isDetailed = i === constraints.currentStage;
      stages.push({
        stageNo: i,
        durationDays: stageDates.durationDays,
        startDate: stageDates.startDate,
        endDate: stageDates.endDate,
        milestones: [
          {
            title: `第 ${i} 阶段：${isDetailed ? "详细执行" : "待展开"}`,
            dueDate: stageDates.endDate,
            weight: 1 / totalStages,
          },
        ],
        tasks: isDetailed
          ? this.buildDailyTasks(
              stageDates.startDate,
              stageDates.durationDays,
              `拆解任务/执行/复盘`,
              30,
              "medium",
            )
          : [],
        isDetailed,
      });
    }

    const currentStage = stages.find(
      (s) => s.stageNo === constraints.currentStage,
    )!;

    return {
      goal: {
        title: `分阶段目标：${userInput.slice(0, 30)}`,
        horizon: this.inferHorizon(constraints.planDuration),
        startDate: today,
        dueDate: planEnd,
        successCriteria: ["完成当前阶段全部任务", "按节奏推进后续阶段"],
      },
      planDuration: constraints.planDuration,
      stageLength: constraints.stageLength,
      currentStage: constraints.currentStage,
      totalStages,
      stages,
      milestones: stages.flatMap((s) => s.milestones),
      tasks: currentStage.tasks,
      habits: [
        {
          title: "每日复盘 5 分钟",
          frequency: "daily",
          preferredTime: "22:00",
          energyLevel: "low",
          minimumStandard: "记录今日完成与明日重点",
        },
      ],
      assumptions: ["用户希望把长期目标拆解为可执行的阶段"],
      warnings: ["若连续阶段无法完成，应降低任务量或延长期限"],
      estimatedWeeklyLoad: {
        totalMinutes: currentStage.durationDays * 30,
        highEnergyMinutes: currentStage.durationDays * 10,
      },
    };
  }

  private advancePlaceholder(
    previousPayload: PlanDraftPayload,
    constraints: PlanConstraints,
  ): PlanDraftPayload {
    const updatedStages = previousPayload.stages.map((s) =>
      s.stageNo === constraints.currentStage
        ? {
            ...s,
            tasks: this.buildDailyTasks(
              s.startDate,
              s.durationDays,
              "拆解任务/执行/复盘",
              30,
              "medium",
            ),
            isDetailed: true,
          }
        : s,
    );
    const currentStage = updatedStages.find(
      (s) => s.stageNo === constraints.currentStage,
    )!;

    return {
      ...previousPayload,
      currentStage: constraints.currentStage,
      stages: updatedStages,
      milestones: updatedStages.flatMap((s) => s.milestones),
      tasks: currentStage.tasks,
    };
  }

  private buildDailyTasks(
    startDate: string,
    count: number,
    baseTitle: string,
    defaultDuration: number,
    defaultEnergy: "high" | "medium" | "low",
  ): PlanTask[] {
    const tasks: PlanTask[] = [];
    for (let i = 0; i < count; i++) {
      tasks.push({
        title: `${baseTitle} 第 ${i + 1} 天`,
        date: this.addDays(startDate, i),
        durationMinutes: defaultDuration,
        energyLevel: defaultEnergy,
        repeatRule: null,
        milestoneRef: "m1",
        minimumStandard: "完成核心内容即可，不必追求完美",
      });
    }
    return tasks;
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  private daysBetween(start: string, end: string): number {
    const a = new Date(start);
    const b = new Date(end);
    return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }

  private inferHorizon(planDuration: number): "long" | "medium" | "short" {
    if (planDuration > 90) return "long";
    if (planDuration > 30) return "medium";
    return "short";
  }

  getPlaceholderDraft(): PlanDraftPayload {
    return this.buildPlaceholderDraft("完成一个通用目标", {
      planDuration: 7,
      stageLength: 7,
      currentStage: 1,
    });
  }

  /**
   * 显式生成占位草案，用于费用上限等主动降级场景。
   */
  buildFallbackDraft(
    userInput: string,
    constraints?: Record<string, unknown>,
  ): PlanDraftPayload {
    return this.buildPlaceholderDraft(
      userInput,
      this.normalizeConstraints(constraints),
    );
  }

  /**
   * 基于模板生成降级草案，用于 AI 费用上限或模型不可用时仍返回贴合场景的计划。
   */
  buildTemplateFallbackDraft(
    template: AITemplate,
    constraints: PlanConstraints,
  ): PlanDraftPayload {
    const today = new Date().toISOString().split("T")[0];
    const totalStages = this.computeStageCount(
      constraints.planDuration,
      constraints.stageLength,
    );
    const planEnd = this.addDays(today, constraints.planDuration - 1);

    const stages: PlanStage[] = [];
    for (let i = 1; i <= totalStages; i++) {
      const stageDates = this.computeStageDates(
        today,
        constraints.stageLength,
        i,
        constraints.planDuration,
      );
      const isDetailed = i === constraints.currentStage;
      const templateMilestone = template.defaultMilestones[i - 1];
      const milestones: PlanMilestone[] = [
        {
          title:
            templateMilestone?.title ??
            `第 ${i} 阶段：${isDetailed ? "详细执行" : "待展开"}`,
          dueDate: templateMilestone?.dueDate ?? stageDates.endDate,
          weight: templateMilestone?.weight ?? 1 / totalStages,
        },
      ];

      let tasks: PlanTask[] = [];
      if (isDetailed) {
        const templateTasks = template.defaultTasks;
        if (templateTasks.length > 0) {
          for (let d = 0; d < stageDates.durationDays; d++) {
            const t = templateTasks[d % templateTasks.length];
            tasks.push({
              title: t.title,
              date: this.addDays(stageDates.startDate, d),
              durationMinutes: t.durationMinutes ?? 30,
              energyLevel: t.energyLevel ?? "medium",
              repeatRule: null,
              milestoneRef: `m${i}`,
              minimumStandard: t.minimumStandard ?? "完成当天任务即可",
            });
          }
        } else {
          tasks = this.buildDailyTasks(
            stageDates.startDate,
            stageDates.durationDays,
            `拆解任务/执行/复盘`,
            30,
            "medium",
          );
        }
      }

      stages.push({
        stageNo: i,
        durationDays: stageDates.durationDays,
        startDate: stageDates.startDate,
        endDate: stageDates.endDate,
        milestones,
        tasks,
        isDetailed,
      });
    }

    const currentStage = stages.find(
      (s) => s.stageNo === constraints.currentStage,
    )!;

    return {
      goal: {
        title: `${template.name}计划`,
        horizon: this.inferHorizon(constraints.planDuration),
        startDate: today,
        dueDate: planEnd,
        successCriteria: [
          `完成${template.name}当前阶段全部任务`,
          "按节奏推进后续阶段",
        ],
      },
      planDuration: constraints.planDuration,
      stageLength: constraints.stageLength,
      currentStage: constraints.currentStage,
      totalStages,
      stages,
      milestones: stages.flatMap((s) => s.milestones),
      tasks: currentStage.tasks,
      habits: template.defaultHabits.map((h) => ({
        title: h.title,
        frequency: h.frequency,
        preferredTime: h.preferredTime,
        energyLevel: h.energyLevel ?? "medium",
        minimumStandard: h.minimumStandard ?? "完成当天最低标准",
      })),
      assumptions: template.assumptions,
      warnings: template.warnings,
      estimatedWeeklyLoad: {
        totalMinutes: currentStage.tasks.reduce(
          (sum, t) => sum + (t.durationMinutes ?? 30),
          0,
        ),
        highEnergyMinutes: currentStage.tasks.reduce(
          (sum, t) =>
            sum + (t.energyLevel === "high" ? (t.durationMinutes ?? 30) : 0),
          0,
        ),
      },
    };
  }
}
