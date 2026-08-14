import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
import { CalendarOAuthService } from "./calendar-oauth.service";

jest.mock("googleapis");

const mockPrisma = {
  calendarSubscription: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  calendarEvent: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const env: Record<string, string> = {
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      GOOGLE_REDIRECT_URI:
        "https://xutaostudy.xyz/api/v1/calendar/oauth/google/callback",
      OAUTH_ENCRYPTION_KEY: "test-key-32bytes-long-enough!!",
    };
    return env[key];
  }),
};

describe("CalendarOAuthService", () => {
  let service: CalendarOAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarOAuthService,
        { provide: PrismaClient, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CalendarOAuthService>(CalendarOAuthService);
    jest.clearAllMocks();
  });

  describe("initiateGoogleAuth", () => {
    it("should return empty url when OAuth is not configured", () => {
      mockConfigService.get
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);
      const result = service.initiateGoogleAuth("u1");
      expect(result.url).toEqual("");
      expect(result.state).toEqual("");
    });

    it("should return Google auth URL when configured", () => {
      const generateAuthUrl = jest
        .fn()
        .mockReturnValue("https://google.com/auth");
      (google.auth.OAuth2 as unknown as jest.Mock).mockImplementation(() => ({
        generateAuthUrl,
      }));

      const result = service.initiateGoogleAuth("u1");

      expect(result.url).toEqual("https://google.com/auth");
      expect(generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: "offline",
          prompt: "consent",
        }),
      );
    });
  });

  describe("handleGoogleCallback", () => {
    it("should save subscription and import events", async () => {
      const getToken = jest.fn().mockResolvedValue({
        tokens: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expiry_date: Date.now() + 3600000,
        },
      });
      const setCredentials = jest.fn();
      const refreshAccessToken = jest.fn().mockResolvedValue({
        credentials: {
          access_token: "new-access-token",
          expiry_date: Date.now() + 3600000,
        },
      });
      const eventsList = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              summary: "测试会议",
              start: { dateTime: new Date().toISOString() },
              end: { dateTime: new Date().toISOString() },
            },
          ],
        },
      });

      const generateAuthUrl = jest
        .fn()
        .mockReturnValue("https://google.com/auth?state=test-state");
      (google.auth.OAuth2 as unknown as jest.Mock).mockImplementation(() => ({
        generateAuthUrl,
        getToken,
        setCredentials,
        refreshAccessToken,
      }));
      (google.calendar as unknown as jest.Mock).mockReturnValue({
        events: { list: eventsList },
      });

      mockPrisma.calendarSubscription.findFirst.mockResolvedValue(null);
      const encryptedAccess = (service as any).encryptToken("access-token");
      const encryptedRefresh = (service as any).encryptToken("refresh-token");
      mockPrisma.calendarSubscription.create.mockResolvedValue({
        id: "sub-1",
        userId: "u1",
        source: "google",
        calendarId: "primary",
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: new Date(Date.now() + 3600000),
        lastSyncAt: null,
        lastSyncResult: null,
      });
      mockPrisma.calendarSubscription.update.mockResolvedValue({});
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: "e1" });

      const { state } = service.initiateGoogleAuth("u1");

      const result = await service.handleGoogleCallback("code", state);

      expect(result.imported).toEqual(1);
      expect(mockPrisma.calendarSubscription.create).toHaveBeenCalled();
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "u1",
            title: "测试会议",
            source: "google",
          }),
        }),
      );
    });
  });
});
