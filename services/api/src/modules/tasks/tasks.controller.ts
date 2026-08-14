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
import { TasksService } from "./tasks.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { CompleteTaskDto } from "./dto/complete-task.dto";
import { PostponeTaskDto } from "./dto/postpone-task.dto";
import { MakeupTaskDto } from "./dto/makeup-task.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: CurrentUserPayload) {
    return this.tasksService.create(user.userId, dto);
  }

  @Get()
  findByDate(
    @Query("date") date: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tasksService.findByDate(user.userId, date);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.tasksService.findOne(user.userId, id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tasksService.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.tasksService.remove(user.userId, id);
  }

  @Post(":id/complete")
  complete(
    @Param("id") id: string,
    @Body() dto: CompleteTaskDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tasksService.complete(user.userId, id, dto);
  }

  @Post(":id/postpone")
  postpone(
    @Param("id") id: string,
    @Body() dto: PostponeTaskDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tasksService.postpone(user.userId, id, dto);
  }

  @Post(":id/makeup")
  makeup(
    @Param("id") id: string,
    @Body() dto: MakeupTaskDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tasksService.makeup(user.userId, id, dto);
  }
}
