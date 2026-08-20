import { IsEnum, IsOptional, IsString, IsUUID, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class ImportPlanFileUploadDto {
  @IsEnum(["master", "weekly"])
  scope: "master" | "weekly";

  @IsUUID()
  @IsOptional()
  parentGoalId?: string;

  @IsString()
  @IsOptional()
  requirements?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  planDuration?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  stageLength?: number;
}
