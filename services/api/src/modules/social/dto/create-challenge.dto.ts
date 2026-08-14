import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateChallengeDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsIn(["habit_streak", "task_count", "goal_progress"])
  type: "habit_streak" | "task_count" | "goal_progress";

  @IsOptional()
  @IsInt()
  @Min(1)
  targetValue?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
