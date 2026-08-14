import { IsString, IsOptional, MinLength } from "class-validator";

export class CreateInboxItemDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
