import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";

const DEFAULT_PREFERENCES = {
  timezone: "Asia/Shanghai",
  availableTime: {} as Record<string, unknown>,
  energyCurve: Object.fromEntries(
    Array.from({ length: 24 }, (_, i) => [String(i), "medium"]),
  ) as Record<string, string>,
  notificationSetting: {
    reminderMinutesBefore: 15,
    doNotDisturbStart: "22:00",
    doNotDisturbEnd: "08:00",
    weekendOff: false,
  } as Record<string, unknown>,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaClient) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        timezone: true,
        availableTime: true,
        energyCurve: true,
        notificationSetting: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    return {
      ...user,
      timezone: user.timezone || DEFAULT_PREFERENCES.timezone,
      availableTime:
        (user.availableTime as Record<string, unknown>) ??
        DEFAULT_PREFERENCES.availableTime,
      energyCurve:
        (user.energyCurve as Record<string, unknown>) ??
        DEFAULT_PREFERENCES.energyCurve,
      notificationSetting:
        (user.notificationSetting as Record<string, unknown>) ??
        DEFAULT_PREFERENCES.notificationSetting,
    };
  }

  async updateFcmToken(userId: string, token: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token },
      select: { id: true, fcmToken: true },
    });
    return { userId: user.id, fcmToken: user.fcmToken };
  }

  async clearFcmToken(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: null },
      select: { id: true, fcmToken: true },
    });
    return { userId: user.id, fcmToken: user.fcmToken };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        availableTime: true,
        energyCurve: true,
        notificationSetting: true,
      },
    });

    if (!existing) {
      throw new NotFoundException("用户不存在");
    }

    const data: Record<string, unknown> = {};

    if (dto.timezone !== undefined) {
      data.timezone = dto.timezone;
    }

    if (dto.availableTime !== undefined) {
      data.availableTime = dto.availableTime as any;
    }

    if (dto.energyCurve !== undefined) {
      data.energyCurve = dto.energyCurve as any;
    }

    if (dto.notificationSetting !== undefined) {
      data.notificationSetting = dto.notificationSetting as any;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        timezone: true,
        availableTime: true,
        energyCurve: true,
        notificationSetting: true,
      },
    });

    return {
      ...user,
      timezone: user.timezone || DEFAULT_PREFERENCES.timezone,
      availableTime:
        (user.availableTime as Record<string, unknown>) ??
        DEFAULT_PREFERENCES.availableTime,
      energyCurve:
        (user.energyCurve as Record<string, unknown>) ??
        DEFAULT_PREFERENCES.energyCurve,
      notificationSetting:
        (user.notificationSetting as Record<string, unknown>) ??
        DEFAULT_PREFERENCES.notificationSetting,
    };
  }
}
