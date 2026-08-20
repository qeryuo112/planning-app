import {
  Controller,
  Delete,
  Get,
  Post,
  Body,
  Param,
  Sse,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { AiService } from "./ai.service";
import { AiInsightsService } from "./ai-insights.service";
import { CreatePlanDraftDto } from "./dto/create-plan-draft.dto";
import { ImportPlanFileDto } from "./dto/import-plan-file.dto";
import { ImportPlanFileUploadDto } from "./dto/import-plan-file-upload.dto";
import { ApprovePlanDto } from "./dto/approve-plan.dto";
import { ReplanDto } from "./dto/replan.dto";
import { ReviewDto } from "./dto/review.dto";
import { PersonalizedRecommendationsQueryDto } from "./dto/personalized-recommendations-query.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

/**
 * AI 计划编排接口
 * 提供计划草案生成、确认、调整、复盘与高级洞察入口。
 */
@Controller("ai")
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiInsightsService: AiInsightsService,
  ) {}

  @Post("plan-drafts")
  createDraft(
    @Body() dto: CreatePlanDraftDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiService.createDraft(user.userId, dto);
  }

  @Post("plan-drafts/stream")
  createStreamDraft(
    @Body() dto: CreatePlanDraftDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiService.createStreamDraft(user.userId, dto);
  }

  @Post("plan-drafts/from-file")
  importPlanFromFile(
    @Body() dto: ImportPlanFileDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiService.createDraftFromFile(user.userId, dto);
  }

  @Post("plan-drafts/from-upload")
  @UseInterceptors(FileInterceptor("file"))
  importPlanFromUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportPlanFileUploadDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException("请上传文件");
    }
    const content = file.buffer.toString("utf-8");
    return this.aiService.createDraftFromFile(user.userId, {
      content,
      fileName: file.originalname,
      scope: dto.scope,
      parentGoalId: dto.parentGoalId,
      requirements: dto.requirements,
      planDuration: dto.planDuration,
      stageLength: dto.stageLength,
    });
  }

  @Get("plan-drafts/:id")
  getDraft(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.aiService.getDraft(user.userId, id);
  }

  @Sse("plan-drafts/:id/stream")
  streamDraft(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiService.streamDraft(user.userId, id);
  }

  @Post("plan-drafts/:id/approve")
  approveDraft(
    @Param("id") id: string,
    @Body() dto: ApprovePlanDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiService.approveDraft(user.userId, id, dto);
  }

  @Post("plan-drafts/:id/advance")
  advanceDraft(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiService.advanceDraft(user.userId, id);
  }

  @Delete("plan-drafts/:id/approved")
  deleteApprovedDraft(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiService.deleteApprovedDraft(user.userId, id);
  }

  @Post("replan")
  replan(@Body() dto: ReplanDto, @CurrentUser() user: CurrentUserPayload) {
    return this.aiService.replan(user.userId, dto);
  }

  @Post("review")
  review(@Body() dto: ReviewDto, @CurrentUser() user: CurrentUserPayload) {
    return this.aiService.review(user.userId, dto);
  }

  @Get("templates")
  listTemplates(@CurrentUser() _user: CurrentUserPayload) {
    return this.aiService.listTemplates();
  }

  @Get("templates/recommend")
  async recommendTemplate(
    @Query("input") input: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return (
      (await this.aiService.getTemplateRecommendation(input, user.userId)) ??
      null
    );
  }

  @Get("usage")
  getUsage(@CurrentUser() user: CurrentUserPayload) {
    return this.aiService.getUsage(user.userId);
  }

  @Get("profile-summary")
  getProfileSummary(
    @Query("useSnapshot") useSnapshot: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiInsightsService.getProfileSummary(
      user.userId,
      useSnapshot === "true",
    );
  }

  @Get("personalized-recommendations")
  getPersonalizedRecommendations(
    @Query() dto: PersonalizedRecommendationsQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiInsightsService.getPersonalizedRecommendations(
      user.userId,
      dto.goalId,
    );
  }
}
