import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

class FitnessActivityDto {
  @IsString()
  @MinLength(1)
  activityType: string;

  @IsDateString()
  startedAt: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  calories?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;
}

export class ImportFitnessDataDto {
  @IsString()
  @MinLength(1)
  source: string;

  @IsOptional()
  @IsUUID()
  habitId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FitnessActivityDto)
  activities: FitnessActivityDto[];
}
