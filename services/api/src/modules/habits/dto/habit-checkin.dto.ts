import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";

export class HabitCheckinDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(["completed", "partial", "skipped", "makeup"])
  result?: "completed" | "partial" | "skipped" | "makeup";

  @IsOptional()
  @IsInt()
  actualMinutes?: number;

  @IsOptional()
  @IsInt()
  qualityRating?: number; // 1-5

  @IsOptional()
  @IsBoolean()
  isMakeup?: boolean;

  @IsOptional()
  @IsString()
  blockReasonTag?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
