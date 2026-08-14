import { IsUrl, MinLength } from "class-validator";

export class SyncExternalCalendarDto {
  @IsUrl()
  @MinLength(1)
  url: string;
}
