import { IsDateString, IsEnum, IsOptional } from "class-validator";

export class UpdateReminderDto {
  @IsOptional()
  @IsDateString()
  triggerAt?: string;

  @IsOptional()
  @IsEnum(["push", "in_app", "email"])
  channel?: "push" | "in_app" | "email";

  @IsOptional()
  repeatRule?: Record<string, unknown> | null;

  @IsOptional()
  @IsEnum(["pending", "sent", "dismissed"])
  status?: "pending" | "sent" | "dismissed";
}
