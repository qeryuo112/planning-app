import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Query,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { CalendarService } from "./calendar.service";
import { CalendarOAuthService } from "./calendar-oauth.service";
import { CalendarSyncService } from "./calendar-sync.service";
import { CreateCalendarEventDto } from "./dto/create-calendar-event.dto";
import { UpdateCalendarEventDto } from "./dto/update-calendar-event.dto";
import { ImportIcsDto } from "./dto/import-ics.dto";
import { SyncExternalCalendarDto } from "./dto/sync-external-calendar.dto";
import { CreateCalendarSubscriptionDto } from "./dto/create-calendar-subscription.dto";

@Controller("calendar")
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly oauthService: CalendarOAuthService,
    private readonly syncService: CalendarSyncService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateCalendarEventDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.calendarService.create(user.userId, dto);
  }

  @Get()
  findByRange(
    @Query("start") start: string,
    @Query("end") end: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.calendarService.findByRange(user.userId, start, end);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCalendarEventDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.calendarService.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.calendarService.remove(user.userId, id);
  }

  @Post("import-ics")
  importIcs(
    @Body() dto: ImportIcsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.calendarService.importIcs(user.userId, dto.icsText);
  }

  @Get("export-ics")
  exportIcs(
    @Query("start") start: string,
    @Query("end") end: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.calendarService.exportIcs(user.userId, start, end);
  }

  @Post("sync-external")
  syncExternal(
    @Body() dto: SyncExternalCalendarDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.calendarService.syncExternalCalendar(user.userId, dto.url);
  }

  @Get("subscriptions")
  findSubscriptions(@CurrentUser() user: CurrentUserPayload) {
    return this.calendarService.findSubscriptions(user.userId);
  }

  @Post("subscriptions")
  createSubscription(
    @Body() dto: CreateCalendarSubscriptionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.calendarService.createSubscription(user.userId, dto);
  }

  @Post("subscriptions/:id/sync")
  syncSubscription(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.syncService.triggerSync(id, user.userId);
  }

  @Delete("subscriptions/:id")
  removeSubscription(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.calendarService.removeSubscription(user.userId, id);
  }

  @Get("oauth/google")
  googleAuth(@CurrentUser() user: CurrentUserPayload) {
    const result = this.oauthService.initiateGoogleAuth(user.userId);
    if (!result.url) {
      return {
        enabled: false,
        message:
          "Google OAuth 未配置，请在服务端 .env 中设置 GOOGLE_CLIENT_ID 等",
      };
    }
    return { enabled: true, url: result.url };
  }

  @Get("oauth/google/callback")
  async googleCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.oauthService.handleGoogleCallback(code, state);
      res.send(`<h1>✅ ${result.message}</h1><p>请返回 App 查看日历</p>`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google 授权失败";
      res.status(400).send(`<h1>❌ 授权失败</h1><p>${message}</p>`);
    }
  }

  @Get("oauth/outlook")
  outlookAuth(@CurrentUser() user: CurrentUserPayload) {
    const result = this.oauthService.initiateOutlookAuth(user.userId);
    if (!result.url) {
      return {
        enabled: false,
        message:
          "Outlook OAuth 未配置，请在服务端 .env 中设置 OUTLOOK_CLIENT_ID 等",
      };
    }
    return { enabled: true, url: result.url };
  }

  @Get("oauth/outlook/callback")
  async outlookCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.oauthService.handleOutlookCallback(code, state);
      res.send(`<h1>✅ ${result.message}</h1><p>请返回 App 查看日历</p>`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Outlook 授权失败";
      res.status(400).send(`<h1>❌ 授权失败</h1><p>${message}</p>`);
    }
  }
}
