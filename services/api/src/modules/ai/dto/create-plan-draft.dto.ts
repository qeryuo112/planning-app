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
  @Min(1)
  @Max(365)
  planDuration?: number = 7;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  stageLength?: number = 7;

  @IsOptional()
  @IsInt()
  @Min(1)
  currentStage?: number = 1;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  followUp?: string;

  @IsOptional()
  @IsObject()
  constraints?: Record<string, unknown>;
}

export class FollowUpDraftDto {
  @IsString()
  sessionId: string;

  @IsString()
  followUp: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;
}
