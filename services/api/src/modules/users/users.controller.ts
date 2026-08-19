import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
} from "@nestjs/common";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { UpdateAiConfigDto } from "./dto/update-ai-config.dto";
import { UpdateFcmTokenDto } from "./dto/update-fcm-token.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getMe(user.userId);
  }

  @Patch("me/preferences")
  updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(user.userId, dto);
  }

  @Post("me/fcm-token")
  updateFcmToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    if (!dto.token || dto.token.trim().length === 0) {
      return this.usersService.clearFcmToken(user.userId);
    }
    return this.usersService.updateFcmToken(user.userId, dto.token.trim());
  }

  @Get("me/ai-config")
  getAiConfig(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getAiConfig(user.userId);
  }

  @Patch("me/ai-config")
  updateAiConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateAiConfigDto,
  ) {
    return this.usersService.updateAiConfig(user.userId, dto);
  }
}
