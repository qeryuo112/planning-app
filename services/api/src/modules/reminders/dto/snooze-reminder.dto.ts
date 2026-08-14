import { IsEnum } from "class-validator";

export class SnoozeReminderDto {
  @IsEnum([15, 30, 60])
  minutes: number;
}
