import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class ShareGoalDto {
  @IsEmail()
  sharedWithEmail: string;

  @IsOptional()
  @IsString()
  @IsIn(["view", "edit"])
  permission?: "view" | "edit" = "view";
}
