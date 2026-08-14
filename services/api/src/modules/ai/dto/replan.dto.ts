import { IsString, IsOptional, IsObject, IsEnum } from "class-validator";

export class ReplanDto {
  @IsString()
  goalId: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  feedback?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  followUp?: string;
}
