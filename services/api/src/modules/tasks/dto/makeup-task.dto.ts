import { IsInt, IsOptional, IsString } from "class-validator";

export class MakeupTaskDto {
  @IsOptional()
  @IsInt()
  actualMinutes?: number;

  @IsOptional()
  @IsInt()
  qualityRating?: number; // 1-5

  @IsOptional()
  @IsString()
  note?: string;
}
