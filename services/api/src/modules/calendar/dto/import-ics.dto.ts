import { IsOptional, IsString, MinLength } from "class-validator";

export class ImportIcsDto {
  @IsString()
  @MinLength(1)
  icsText: string;

  @IsOptional()
  @IsString()
  source?: string;
}
