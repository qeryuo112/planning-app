import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { SocialService } from "./social.service";
import { ShareGoalDto } from "./dto/share-goal.dto";
import { RespondShareDto } from "./dto/respond-share.dto";
import { CreateChallengeDto } from "./dto/create-challenge.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("social")
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post("goals/:id/share")
  shareGoal(
    @Param("id") goalId: string,
    @Body() dto: ShareGoalDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.socialService.shareGoal(user.userId, goalId, dto);
  }

  @Get("shares/received")
  listReceivedShares(
    @Query("status") status: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.socialService.listReceivedShares(user.userId, status);
  }

  @Get("shares/owned")
  listOwnedShares(@CurrentUser() user: CurrentUserPayload) {
    return this.socialService.listOwnedShares(user.userId);
  }

  @Post("shares/:id/respond")
  respondToShare(
    @Param("id") shareId: string,
    @Body() dto: RespondShareDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.socialService.respondToShare(user.userId, shareId, dto);
  }

  @Post("challenges")
  createChallenge(
    @Body() dto: CreateChallengeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.socialService.createChallenge(user.userId, dto);
  }

  @Get("challenges")
  listChallenges(
    @Query("status") status: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.socialService.listChallenges(user.userId, status);
  }

  @Post("challenges/:id/join")
  joinChallenge(
    @Param("id") challengeId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.socialService.joinChallenge(user.userId, challengeId);
  }

  @Get("challenges/:id/leaderboard")
  getLeaderboard(
    @Param("id") challengeId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.socialService.getLeaderboard(user.userId, challengeId);
  }
}
