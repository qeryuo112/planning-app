import { Controller, Get, Post, Query } from "@nestjs/common";
import { CheckinsService } from "./checkins.service";

@Controller("checkins")
export class CheckinsController {
  constructor(private readonly checkinsService: CheckinsService) {}

  @Post()
  create() {
    return this.checkinsService.create();
  }

  @Get("calendar")
  calendar() {
    return this.checkinsService.calendar();
  }

  @Get("stats")
  stats(@Query("from") from: string, @Query("to") to: string) {
    return this.checkinsService.stats(from, to);
  }
}
