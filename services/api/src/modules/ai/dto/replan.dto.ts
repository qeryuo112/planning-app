import { IsString, IsOptional, IsObject } from "class-validator";

export class ReplanDto {
  @IsString()
  goalId: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  feedback?: Record<string, unknown>;
}
