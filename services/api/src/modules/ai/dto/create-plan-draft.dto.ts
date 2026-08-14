import {
  IsString,
  IsOptional,
  IsObject,
  IsUUID,
  IsInt,
  Min,
  Max,
} from "class-validator";

export class CreatePlanDraftDto {
  @IsString()
  userInput: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(365)
  planDuration?: number = 7;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(30)
  stageLength?: number = 7;

  @IsOptional()
  @IsInt()
  @Min(1)
  currentStage?: number = 1;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  constraints?: Record<string, unknown>;
}
