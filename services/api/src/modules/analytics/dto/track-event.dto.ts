import {
  IsString,
  IsOptional,
  IsObject,
  IsISO8601,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class TrackEventDto {
  @IsString()
  eventType: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  clientTimestamp?: string;
}

export class TrackEventBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events: TrackEventDto[];
}
