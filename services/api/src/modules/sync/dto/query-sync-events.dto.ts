import { IsDateString, IsOptional, IsString } from "class-validator";

export class QuerySyncEventsDto {
  @IsOptional()
  @IsDateString()
  after?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  eventType?: string;
}
