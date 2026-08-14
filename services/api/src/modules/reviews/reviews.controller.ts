import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  create(
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewsService.create(user.userId, dto);
  }

  @Get()
  findAll(
    @Query("goalId") goalId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewsService.findAll(user.userId, goalId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.reviewsService.findOne(user.userId, id);
  }
}
