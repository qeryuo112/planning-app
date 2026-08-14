import { IsDateString, IsOptional, IsString } from "class-validator";

export class PostponeTaskDto {
  @IsOptional()
  @IsDateString()
  newScheduledDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
