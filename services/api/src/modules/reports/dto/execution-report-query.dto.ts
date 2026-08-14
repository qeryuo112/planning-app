import { IsDateString, IsIn } from "class-validator";

export class ExecutionReportQueryDto {
  @IsIn(["weekly", "monthly", "yearly"])
  period: "weekly" | "monthly" | "yearly";

  @IsDateString()
  date: string;
}
