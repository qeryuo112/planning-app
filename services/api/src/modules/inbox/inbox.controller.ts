import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { InboxService } from "./inbox.service";
import { CreateInboxItemDto } from "./dto/create-inbox-item.dto";
import { UpdateInboxItemDto } from "./dto/update-inbox-item.dto";
import { ConvertInboxItemDto } from "./dto/convert-inbox-item.dto";

@Controller("inbox")
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Post()
  create(
    @Body() dto: CreateInboxItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inboxService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.inboxService.findAll(user.userId);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateInboxItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inboxService.update(user.userId, id, dto);
  }

  @Post(":id/convert")
  convert(
    @Param("id") id: string,
    @Body() dto: ConvertInboxItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inboxService.convert(user.userId, id, dto);
  }

  @Post(":id/dismiss")
  dismiss(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.inboxService.dismiss(user.userId, id);
  }
}
