import { IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateAiConfigDto {
  @IsString()
  @IsOptional()
  aiProvider?: string;

  @IsString()
  @IsOptional()
  aiModel?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  aiBaseUrl?: string;

  @IsString()
  @IsOptional()
  aiApiKey?: string;
}
