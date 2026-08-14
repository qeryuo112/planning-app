import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;
}
