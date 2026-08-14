import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { HabitsService } from "./habits.service";
import { CreateHabitDto } from "./dto/create-habit.dto";
import { UpdateHabitDto } from "./dto/update-habit.dto";
import { HabitCheckinDto } from "./dto/habit-checkin.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("habits")
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Post()
  create(@Body() dto: CreateHabitDto, @CurrentUser() user: CurrentUserPayload) {
    return this.habitsService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.habitsService.findAll(user.userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.habitsService.findOne(user.userId, id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateHabitDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.habitsService.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.habitsService.remove(user.userId, id);
  }

  @Post(":id/checkin")
  checkin(
    @Param("id") id: string,
    @Body() dto: HabitCheckinDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.habitsService.checkin(user.userId, id, dto);
  }

  @Get(":id/stats")
  stats(
    @Param("id") id: string,
    @Query("days") days: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.habitsService.stats(user.userId, id, parsedDays);
  }
}
