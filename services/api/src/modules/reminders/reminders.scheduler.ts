import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { RemindersService } from "./reminders.service";

/**
 * 提醒定时任务
 * 每 15 秒扫描一次到期的 pending 提醒并广播，确保 WebSocket 实时推送更及时。
 */
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(private readonly remindersService: RemindersService) {}

  @Interval(15000)
  async handleDueReminders() {
    this.logger.debug("定时任务：扫描到期提醒");

    try {
      const result = await this.remindersService.processDueReminders();
      this.logger.debug(`已处理 ${result.processed} 条到期提醒`);
    } catch (e) {
      this.logger.error("扫描到期提醒失败", e);
    }
  }
}
