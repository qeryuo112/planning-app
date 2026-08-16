import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { ModelAdapter } from "./model-adapter.service";

export type AiContextType = "goal" | "task" | "review" | "replan" | "general";

export interface CreateMessageInput {
  sessionId: string;
  role: "system" | "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AiSessionService {
  private readonly logger = new Logger(AiSessionService.name);
  private readonly maxTurnsBeforeSummarize = 10;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: ConfigService,
    private readonly modelAdapter: ModelAdapter,
  ) {}

  async getOrCreateSession(
    userId: string,
    contextType: AiContextType,
    contextId?: string,
  ) {
    // 查找该上下文下最近活跃的 session（24 小时内）
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.prisma.aISession.findFirst({
      where: {
        userId,
        contextType,
        contextId: contextId ?? null,
        updatedAt: { gte: oneDayAgo },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.aISession.create({
      data: {
        userId,
        contextType,
        contextId: contextId ?? null,
      },
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.aISession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException("会话不存在");
    }
    return session;
  }

  async getMessages(sessionId: string, limit = 20) {
    return this.prisma.aIMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async addMessages(inputs: CreateMessageInput[]) {
    if (inputs.length === 0) return [];

    await this.prisma.aIMessage.createMany({
      data: inputs.map((input) => ({
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        metadata: (input.metadata ?? {}) as any,
      })),
    });

    await this.prisma.aISession.update({
      where: { id: inputs[0].sessionId },
      data: { turnCount: { increment: inputs.length } },
    });

    this.logger.debug(`会话新增 ${inputs.length} 条消息: ${inputs[0].sessionId}`);

    return this.prisma.aIMessage.findMany({
      where: {
        sessionId: inputs[0].sessionId,
        createdAt: { gte: new Date(Date.now() - 5000) },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async addMessage(input: CreateMessageInput) {
    const [record] = await this.addMessages([input]);
    return record;
  }

  async maybeSummarize(sessionId: string) {
    const session = await this.prisma.aISession.findUnique({
      where: { id: sessionId },
      select: { turnCount: true, summary: true },
    });

    if (!session) return;
    if (session.turnCount < this.maxTurnsBeforeSummarize) return;
    if (session.summary) return; // 暂不重复摘要，后续可增量摘要

    const recentMessages = await this.prisma.aIMessage.findMany({
      where: { sessionId, role: { in: ["user", "assistant"] } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const conversation = recentMessages
      .map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content.slice(0, 300)}`)
      .join("\n");

    const prompt = `请用 100 字以内总结以下 AI 计划教练与用户的多轮对话核心内容，包括：目标主题、用户主要调整要求、当前已达成共识。只输出总结文本，不要输出 JSON 或其他格式。\n\n${conversation}`;

    const cheapModel = this.resolveCheapModel();
    try {
      const response = await this.modelAdapter.generateStructured<{ summary: string }>(
        prompt,
        {
          type: "object",
          properties: { summary: { type: "string", maxLength: 300 } },
          required: ["summary"],
        },
        { modelName: cheapModel },
      );

      const summary = response.data?.summary?.trim();
      if (summary) {
        await this.prisma.aISession.update({
          where: { id: sessionId },
          data: { summary },
        });
        this.logger.debug(`会话已生成摘要: ${sessionId}`);
      } else {
        this.logger.warn(`会话摘要生成结果为空: ${sessionId}`);
      }
    } catch (err) {
      this.logger.warn(`会话摘要生成失败: ${sessionId}, ${(err as Error).message}`);
    }
  }

  private resolveCheapModel(): string {
    const defaultModel = this.modelAdapter.getConfig().model;
    const configured = this.configService.get<string>("AI_CHEAP_MODEL");
    return configured?.trim() || defaultModel;
  }

  toChatMessages(messages: { role: string; content: string }[]) {
    return messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));
  }
}
