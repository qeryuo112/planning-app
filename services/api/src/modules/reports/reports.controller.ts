import { Controller, Get, Query } from "@nestjs/common";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { ReportsService } from "./reports.service";
import { ExecutionReportQueryDto } from "./dto/execution-report-query.dto";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("execution")
  executionReport(
    @Query() dto: ExecutionReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reportsService.getExecutionReport(
      user.userId,
      dto.period,
      dto.date,
    );
  }

  @Get("energy")
  energyAnalysis(@CurrentUser() user: CurrentUserPayload) {
    return this.reportsService.getEnergyAnalysis(user.userId);
  }

  @Get("best-time")
  bestTimeReport(@CurrentUser() user: CurrentUserPayload) {
    return this.reportsService.getBestTimeReport(user.userId);
  }
}
