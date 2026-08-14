import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { GoalsService } from "./goals.service";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";

@Controller("goals")
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@Body() dto: CreateGoalDto, @CurrentUser() user: CurrentUserPayload) {
    return this.goalsService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.goalsService.findAll(user.userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.goalsService.findOne(user.userId, id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateGoalDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.goalsService.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.goalsService.remove(user.userId, id);
  }

  @Get(":id/stats")
  stats(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.goalsService.stats(user.userId, id);
  }

  @Post(":id/recalculate")
  recalculate(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.goalsService.recalculate(user.userId, id);
  }
}
