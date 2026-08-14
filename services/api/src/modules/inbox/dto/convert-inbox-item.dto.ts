import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export enum ConvertTargetType {
  TASK = "task",
  GOAL = "goal",
  PROJECT = "project",
}

export class ConvertInboxItemDto {
  @IsEnum(ConvertTargetType)
  targetType: ConvertTargetType;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  milestoneId?: string;

  @IsOptional()
  @IsString()
  scheduledDate?: string;
}
