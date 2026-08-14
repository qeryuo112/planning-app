import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Response } from "express";
import { Observable, tap } from "rxjs";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method ?? "UNKNOWN";
    const route = this.normalizeRoute(request);
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.observe(method, route, response.statusCode, start, false);
        },
        error: () => {
          // 异常过滤器执行后 statusCode 已写入响应
          this.observe(method, route, response.statusCode, start, true);
        },
      }),
    );
  }

  private observe(
    method: string,
    route: string,
    statusCode: number,
    start: number,
    isError: boolean,
  ) {
    const duration = (Date.now() - start) / 1000;
    this.metrics.httpRequestDuration
      .labels(method, route, String(statusCode))
      .observe(duration);

    if (isError || statusCode >= 400) {
      this.metrics.apiErrorsTotal
        .labels(method, route, String(statusCode))
        .inc();
    }
  }

  private normalizeRoute(request: any): string {
    const route = request.route;
    if (!route) return request.path ?? "unknown";
    const basePath = route.path ?? "unknown";
    // 移除 API 版本前缀，保持标签稳定
    return basePath.replace(/^\/api\/v\d+/, "");
  }
}
