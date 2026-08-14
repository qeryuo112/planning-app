import { Controller, Get, Query } from "@nestjs/common";
import { TodayService } from "./today.service";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

/**
 * 今日视图接口
 * 返回首页聚合数据：Top 3 任务、习惯打卡、目标进度、连续打卡。
 */
@Controller("today")
export class TodayController {
  constructor(private readonly todayService: TodayService) {}

  @Get()
  getToday(
    @Query("date") date: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.todayService.getToday(user.userId, date);
  }
}
