import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
import * as crypto from "crypto";

interface OAuthStatePayload {
  userId: string;
  provider: string;
  exp?: number;
}

/**
 * 日历 OAuth 服务
 * 负责生成 Google / Outlook 授权链接、处理回调、保存订阅。
 */
@Injectable()
export class CalendarOAuthService {
  private readonly logger = new Logger(CalendarOAuthService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 生成 Google OAuth 授权 URL。
   * 若未配置 OAuth 客户端，则返回未启用提示。
   */
  initiateGoogleAuth(userId: string): { url: string; state: string } {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.configService.get<string>("GOOGLE_CLIENT_SECRET");
    const redirectUri = this.configService.get<string>("GOOGLE_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      return {
        url: "",
        state: "",
      };
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    const state = this.encryptState({ userId, provider: "google" });

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/calendar.readonly"],
      state,
    });

    return { url, state };
  }

  /**
   * 处理 Google OAuth 回调，保存 subscription 并立即同步一次主日历。
   */
  async handleGoogleCallback(
    code: string,
    state: string,
  ): Promise<{ imported: number; message: string }> {
    const payload = this.decryptState(state);
    if (!payload || payload.provider !== "google") {
      throw new BadRequestException("授权状态无效或已过期");
    }

    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.configService.get<string>("GOOGLE_CLIENT_SECRET");
    const redirectUri = this.configService.get<string>("GOOGLE_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException("Google OAuth 未配置");
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      this.logger.warn("Google 未返回 refresh_token，可能需要重新授权");
    }

    const existing = await this.prisma.calendarSubscription.findFirst({
      where: {
        userId: payload.userId,
        source: "google",
        calendarId: "primary",
      },
    });

    const subscription = existing
      ? await this.prisma.calendarSubscription.update({
          where: { id: existing.id },
          data: {
            name: existing.name || "Google 主日历",
            accessToken: tokens.access_token
              ? this.encryptToken(tokens.access_token)
              : existing.accessToken,
            refreshToken: tokens.refresh_token
              ? this.encryptToken(tokens.refresh_token)
              : existing.refreshToken,
            tokenExpiresAt: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : null,
            isActive: true,
            lastSyncResult: {},
          },
        })
      : await this.prisma.calendarSubscription.create({
          data: {
            userId: payload.userId,
            name: "Google 主日历",
            source: "google",
            calendarId: "primary",
            accessToken: tokens.access_token
              ? this.encryptToken(tokens.access_token)
              : null,
            refreshToken: tokens.refresh_token
              ? this.encryptToken(tokens.refresh_token)
              : null,
            tokenExpiresAt: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : null,
          },
        });

    // 立即拉取主日历事件
    const imported = await this.importGoogleEvents(subscription);

    return {
      imported,
      message: "Google 日历授权成功，请返回 App",
    };
  }

  /**
   * 拉取 Google 主日历近 30 天事件并导入。
   * 返回导入事件数。
   */
  private async importGoogleEvents(subscription: {
    id: string;
    userId: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
  }): Promise<number> {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.configService.get<string>("GOOGLE_CLIENT_SECRET");
    const redirectUri = this.configService.get<string>("GOOGLE_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException("Google OAuth 未配置");
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    const accessToken = subscription.accessToken
      ? this.decryptToken(subscription.accessToken)
      : null;
    const refreshToken = subscription.refreshToken
      ? this.decryptToken(subscription.refreshToken)
      : null;

    if (!accessToken && !refreshToken) {
      throw new BadRequestException("Google 授权令牌缺失");
    }

    oauth2Client.setCredentials({
      access_token: accessToken ?? undefined,
      refresh_token: refreshToken ?? undefined,
      expiry_date: subscription.tokenExpiresAt?.getTime(),
    });

    // 自动刷新 access token
    if (
      refreshToken &&
      (!subscription.tokenExpiresAt ||
        subscription.tokenExpiresAt.getTime() <= Date.now())
    ) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await this.prisma.calendarSubscription.update({
        where: { id: subscription.id },
        data: {
          accessToken: credentials.access_token
            ? this.encryptToken(credentials.access_token)
            : null,
          tokenExpiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
        },
      });
      oauth2Client.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 1000,
    });

    const items = res.data.items ?? [];
    let imported = 0;

    const existing = await this.prisma.calendarEvent.findMany({
      where: { userId: subscription.userId },
      select: { title: true, startAt: true },
    });
    const existingKeys = new Set(
      existing.map((e) => `${e.title}|${e.startAt.toISOString()}`),
    );

    for (const item of items) {
      const title = item.summary || "(无标题)";
      const start = item.start?.dateTime ?? item.start?.date;
      const end = item.end?.dateTime ?? item.end?.date;
      if (!start) continue;

      const startAt = new Date(start);
      const endAt = end ? new Date(end) : null;
      const key = `${title}|${startAt.toISOString()}`;
      if (existingKeys.has(key)) continue;

      await this.prisma.calendarEvent.create({
        data: {
          userId: subscription.userId,
          title,
          description: item.description || null,
          startAt,
          endAt,
          source: "google",
        },
      });

      existingKeys.add(key);
      imported++;
    }

    await this.prisma.calendarSubscription.update({
      where: { id: subscription.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncResult: { imported, total: items.length },
      },
    });

    this.logger.debug(
      `Google 日历同步完成: user=${subscription.userId}, imported=${imported}`,
    );
    return imported;
  }

  /**
   * Outlook OAuth scaffold。个人版当前未启用，返回未实现提示。
   */
  initiateOutlookAuth(userId: string): { url: string; state: string } {
    const clientId = this.configService.get<string>("OUTLOOK_CLIENT_ID");
    if (!clientId) {
      return { url: "", state: "" };
    }

    const state = this.encryptState({ userId, provider: "outlook" });
    const tenant = "common";
    const redirectUri = this.configService.get<string>("OUTLOOK_REDIRECT_URI");
    const scope = encodeURIComponent(
      "https://graph.microsoft.com/Calendars.Read offline_access",
    );
    const url =
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
        redirectUri || "",
      )}&scope=${scope}&state=${state}&response_mode=query`;

    return { url, state };
  }

  async handleOutlookCallback(
    code: string,
    state: string,
  ): Promise<{ imported: number; message: string }> {
    void code;
    const payload = this.decryptState(state);
    if (!payload || payload.provider !== "outlook") {
      throw new BadRequestException("授权状态无效或已过期");
    }
    throw new BadRequestException(
      "Outlook 日历集成在个人版尚未实现，请使用 Google 日历或 ICS 订阅",
    );
  }

  /**
   * 同步单个 Google 订阅（由 CalendarSyncService 调用）。
   */
  async syncGoogleSubscription(subscriptionId: string): Promise<void> {
    const subscription = await this.prisma.calendarSubscription.findUnique({
      where: { id: subscriptionId },
    });
    if (
      !subscription ||
      subscription.source !== "google" ||
      !subscription.isActive
    ) {
      throw new NotFoundException("Google 日历订阅不存在或已停用");
    }
    await this.importGoogleEvents(subscription);
  }

  private encryptState(payload: OAuthStatePayload): string {
    const secret = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", secret, iv);
    const text = JSON.stringify({
      ...payload,
      exp: Date.now() + 10 * 60 * 1000,
    });
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
  }

  private decryptState(token: string): OAuthStatePayload | null {
    try {
      const secret = this.getEncryptionKey();
      const [ivHex, encrypted] = token.split(":");
      if (!ivHex || !encrypted) return null;
      const iv = Buffer.from(ivHex, "hex");
      const decipher = crypto.createDecipheriv("aes-256-cbc", secret, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      const payload = JSON.parse(decrypted) as OAuthStatePayload;
      if (payload.exp && payload.exp < Date.now()) return null;
      return payload;
    } catch (err) {
      this.logger.warn(`state 解密失败: ${(err as Error).message}`);
      return null;
    }
  }

  private encryptToken(token: string): string {
    const secret = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", secret, iv);
    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
  }

  private decryptToken(encrypted: string): string {
    const secret = this.getEncryptionKey();
    const [ivHex, encryptedText] = encrypted.split(":");
    if (!ivHex || !encryptedText) return "";
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", secret, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  private getEncryptionKey(): Buffer {
    const raw =
      this.configService.get<string>("OAUTH_ENCRYPTION_KEY") ||
      this.configService.get<string>("JWT_SECRET") ||
      "planning-app-default-key-32bytes!";
    return crypto.createHash("sha256").update(raw).digest();
  }
}
