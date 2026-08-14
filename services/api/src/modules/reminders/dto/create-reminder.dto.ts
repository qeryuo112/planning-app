import { IsDateString, IsEnum, IsOptional, IsUUID } from "class-validator";

export class CreateReminderDto {
  @IsEnum(["goal", "task", "habit"])
  targetType: "goal" | "task" | "habit";

  @IsUUID()
  targetId: string;

  @IsDateString()
  triggerAt: string;

  @IsOptional()
  @IsEnum(["push", "in_app", "email"])
  channel?: "push" | "in_app" | "email";

  @IsOptional()
  repeatRule?: Record<string, unknown>;
}
