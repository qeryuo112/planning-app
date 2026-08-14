import { IsIn, IsString } from "class-validator";

export class RespondShareDto {
  @IsString()
  @IsIn(["accepted", "declined"])
  status: "accepted" | "declined";
}
