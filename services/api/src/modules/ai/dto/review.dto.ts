import { IsString, IsOptional, IsEnum } from "class-validator";

export enum ReviewPeriod {
  DAILY = "daily",
  WEEKLY = "weekly",
}

export class ReviewDto {
  @IsString()
  goalId: string;

  @IsEnum(ReviewPeriod)
  @IsOptional()
  period?: ReviewPeriod = ReviewPeriod.WEEKLY;

  @IsOptional()
  @IsString()
  endDate?: string;
}
