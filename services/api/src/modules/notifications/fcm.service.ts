import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import {
  initializeApp,
  cert,
  getApp,
  App,
} from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import { PrismaClient } from "@prisma/client";

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly app: App | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaClient,
  ) {
    let credentialsJson = this.configService.get<string>(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON",
    );

    if (!credentialsJson || credentialsJson.trim().length === 0) {
      this.logger.warn(
        "GOOGLE_APPLICATION_CREDENTIALS_JSON 未配置，FCM 推送将不可用",
      );
      return;
    }

    // 支持直接配置 JSON 字符串，或配置 JSON 文件路径
    if (!credentialsJson.trim().startsWith("{")) {
      try {
        credentialsJson = readFileSync(credentialsJson.trim(), "utf8");
      } catch (fileErr) {
        this.logger.error(
          `读取 FCM 凭据文件失败: ${(fileErr as Error).message}`,
        );
        return;
      }
    }

    try {
      const credential = cert(JSON.parse(credentialsJson));
      this.app = initializeApp({
        credential,
      });
      this.logger.log("FCM 初始化完成");
    } catch (err) {
      // 可能已存在默认 app，尝试复用
      try {
        this.app = getApp();
        this.logger.log("FCM 复用已有默认 app");
      } catch {
        this.logger.error(
          `FCM 初始化失败: ${(err as Error).message}`,
        );
      }
    }
  }

  async sendToUser(userId: string, payload: FcmPayload): Promise<boolean> {
    if (!this.app) {
      this.logger.debug(`FCM 未初始化，跳过推送给 user=${userId}`);
      return false;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    const token = user?.fcmToken;
    if (!token) {
      this.logger.debug(`用户无 FCM token: user=${userId}`);
      return false;
    }

    try {
      await getMessaging(this.app).send({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data ?? {},
      });
      this.logger.debug(`FCM 推送成功: user=${userId}`);
      return true;
    } catch (err: any) {
      const code = err?.errorInfo?.code as string | undefined;
      const message = err?.message ?? err?.toString?.() ?? "unknown";
      this.logger.warn(
        `FCM 推送失败: user=${userId}, code=${code ?? "unknown"}, message=${message}`,
      );

      // 令牌失效或注册令牌无效，清理用户 token
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { fcmToken: null },
        });
        this.logger.debug(`已清理失效 FCM token: user=${userId}`);
      }

      return false;
    }
  }
}
