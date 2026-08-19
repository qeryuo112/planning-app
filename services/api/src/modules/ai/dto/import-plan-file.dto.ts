import { IsEnum, IsOptional, IsString, IsUUID, IsInt, Min } from "class-validator";

export class ImportPlanFileDto {
  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  fileName?: string;

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
  planDuration?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  stageLength?: number;
}
