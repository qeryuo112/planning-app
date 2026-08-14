import { IsOptional, IsUUID } from "class-validator";

export class PersonalizedRecommendationsQueryDto {
  @IsOptional()
  @IsUUID()
  goalId?: string;
}
