import { IsOptional, IsString } from "class-validator";

export class UpdateFcmTokenDto {
  @IsString()
  @IsOptional()
  token?: string;
}
