import { IsBoolean, IsOptional, IsObject, IsString } from "class-validator";

export class ApprovePlanDto {
  @IsBoolean()
  @IsOptional()
  confirmed?: boolean = true;

  @IsOptional()
  @IsObject()
  overrides?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  feedback?: string;
}
