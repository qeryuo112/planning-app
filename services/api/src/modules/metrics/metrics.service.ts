import { Injectable } from "@nestjs/common";
import { Counter, Histogram, register } from "prom-client";

@Injectable()
export class MetricsService {
  readonly httpRequestDuration: Histogram<string>;
  readonly apiErrorsTotal: Counter<string>;
  readonly aiCallsTotal: Counter<string>;
  readonly remindersPushedTotal: Counter<string>;
  readonly analyticsTrackedTotal: Counter<string>;

  constructor() {
    this.httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.apiErrorsTotal = new Counter({
      name: "api_errors_total",
      help: "Total number of API errors",
      labelNames: ["method", "route", "status_code"],
    });

    this.aiCallsTotal = new Counter({
      name: "ai_calls_total",
      help: "Total number of AI model calls",
      labelNames: ["model", "operation", "fallback"],
    });

    this.remindersPushedTotal = new Counter({
      name: "reminders_pushed_total",
      help: "Total number of reminder push attempts",
      labelNames: ["status", "channel"],
    });

    this.analyticsTrackedTotal = new Counter({
      name: "analytics_tracked_total",
      help: "Total number of tracked UserEvent records",
      labelNames: ["event_type"],
    });

    // 确保所有自定义指标被注册到默认 register（兼容 @willsoto/nestjs-prometheus 的默认指标）
    [
      this.httpRequestDuration,
      this.apiErrorsTotal,
      this.aiCallsTotal,
      this.remindersPushedTotal,
      this.analyticsTrackedTotal,
    ].forEach((metric) => {
      try {
        register.registerMetric(metric);
      } catch {
        // 已注册则忽略，避免热重载时重复注册报错
      }
    });
  }
}
