import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";

export class CompleteTaskDto {
  @IsOptional()
  @IsInt()
  actualMinutes?: number;

  @IsOptional()
  @IsInt()
  qualityRating?: number; // 1-5

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(["completed", "partial"])
  result?: "completed" | "partial";
}
