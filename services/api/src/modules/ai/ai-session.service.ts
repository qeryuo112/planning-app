import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

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

  constructor(private readonly prisma: PrismaClient) {}

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

    // 占位摘要：取最近用户消息拼接（实际应调用 cheap 模型）
    const recentMessages = await this.prisma.aIMessage.findMany({
      where: { sessionId, role: { in: ["user", "assistant"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const summary = recentMessages
      .map((m) => `${m.role}: ${m.content.slice(0, 100)}`)
      .join("\n");

    await this.prisma.aISession.update({
      where: { id: sessionId },
      data: { summary },
    });

    this.logger.debug(`会话已生成摘要: ${sessionId}`);
  }

  toChatMessages(messages: { role: string; content: string }[]) {
    return messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));
  }
}
