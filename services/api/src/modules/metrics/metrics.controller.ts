import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { register } from "prom-client";
import { Public } from "../auth/public.decorator";

@Controller("metrics")
export class MetricsController {
  @Get()
  @Public()
  async index(@Res() response: Response) {
    response.set("Content-Type", register.contentType);
    response.end(await register.metrics());
  }
}
