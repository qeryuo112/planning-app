import { IsDateString, IsEnum, IsObject, IsString } from "class-validator";

export enum ReviewPeriod {
  DAILY = "daily",
  WEEKLY = "weekly",
}

export class CreateReviewDto {
  @IsString()
  goalId: string;

  @IsEnum(ReviewPeriod)
  period: ReviewPeriod;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  summary: string;

  @IsObject()
  insights: Record<string, unknown>;

  @IsObject()
  nextActions: Record<string, unknown>;
}
