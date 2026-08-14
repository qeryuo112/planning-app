import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class UpdateHabitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(["daily", "weekly", "weekdays"])
  frequency?: "daily" | "weekly" | "weekdays";

  @IsOptional()
  @IsString()
  preferredTime?: string;

  @IsOptional()
  @IsEnum(["high", "medium", "low"])
  energyLevel?: "high" | "medium" | "low";

  @IsOptional()
  @IsString()
  minimumStandard?: string;

  @IsOptional()
  @IsUUID("4", { each: true })
  goalIds?: string[];
}
