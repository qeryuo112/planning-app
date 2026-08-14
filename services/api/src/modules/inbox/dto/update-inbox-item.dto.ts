import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateInboxItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
