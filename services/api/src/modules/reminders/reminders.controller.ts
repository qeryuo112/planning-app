import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { RemindersService } from "./reminders.service";
import { CreateReminderDto } from "./dto/create-reminder.dto";
import { UpdateReminderDto } from "./dto/update-reminder.dto";
import { SnoozeReminderDto } from "./dto/snooze-reminder.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("reminders")
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  create(
    @Body() dto: CreateReminderDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.remindersService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.remindersService.findAll(user.userId);
  }

  @Get("upcoming")
  upcoming(@CurrentUser() user: CurrentUserPayload) {
    return this.remindersService.upcoming(user.userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.remindersService.findOne(user.userId, id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateReminderDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.remindersService.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.remindersService.remove(user.userId, id);
  }

  @Post(":id/dismiss")
  dismiss(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.remindersService.dismiss(user.userId, id);
  }

  @Post(":id/snooze")
  snooze(
    @Param("id") id: string,
    @Body() dto: SnoozeReminderDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.remindersService.snooze(user.userId, id, dto.minutes);
  }
}
