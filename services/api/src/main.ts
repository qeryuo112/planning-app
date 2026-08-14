import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Logger, LoggerErrorInterceptor } from "nestjs-pino";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { MetricsService } from "./modules/metrics/metrics.service";
import { MetricsInterceptor } from "./modules/metrics/metrics.interceptor";

/**
 * 应用入口
 * 配置全局管道、API 版本、Swagger 文档与结构化日志。
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  // 全局校验管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 全局异常日志拦截
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  // 全局 Prometheus 指标拦截（请求延迟与响应状态）
  app.useGlobalInterceptors(
    new MetricsInterceptor(app.get(MetricsService)),
  );

  // API 版本前缀 /api/v1
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Swagger 文档（开发环境）
  const swaggerConfig = new DocumentBuilder()
    .setTitle("计划型 App API")
    .setDescription("AI 驱动的个人目标与行动管理工具")
    .setVersion("0.0.1")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = configService.get<number>("PORT", 3000);
  await app.listen(port);

  // 使用结构化日志记录启动完成，便于后续排查端口冲突或启动失败
  const logger = app.get(Logger);
  logger.log(`Application is running on: http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Bootstrap failed", err);
  process.exit(1);
});
