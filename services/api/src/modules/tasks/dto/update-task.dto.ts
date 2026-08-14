import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from "class-validator";
import { RepeatRuleDto } from "./create-task.dto";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsUUID()
  milestoneId?: string | null;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsEnum(["high", "medium", "low"])
  energyLevel?: "high" | "medium" | "low";

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  weight?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RepeatRuleDto)
  repeatRule?: RepeatRuleDto | null;

  @IsOptional()
  @IsString()
  minimumStandard?: string;

  @IsOptional()
  @IsEnum(["todo", "done", "skipped", "postponed"])
  status?: "todo" | "done" | "skipped" | "postponed";
}
