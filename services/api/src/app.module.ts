import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { LoggerModule } from "nestjs-pino";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/jwt-auth.guard";
import { UsersModule } from "./modules/users/users.module";
import { GoalsModule } from "./modules/goals/goals.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { HabitsModule } from "./modules/habits/habits.module";
import { CheckinsModule } from "./modules/checkins/checkins.module";
import { RemindersModule } from "./modules/reminders/reminders.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { AiModule } from "./modules/ai/ai.module";
import { TodayModule } from "./modules/today/today.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { MetricsModule } from "./modules/metrics/metrics.module";
import { PrismaModule } from "./modules/prisma.module";
import { RedisModule } from "./modules/redis.module";
import { SyncModule } from "./modules/sync/sync.module";
import { InboxModule } from "./modules/inbox/inbox.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { SocialModule } from "./modules/social/social.module";
import { ExternalModule } from "./modules/external/external.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ScheduleModule } from "@nestjs/schedule";
import { NotificationsModule } from "./modules/notifications/notifications.module";

/**
 * 根模块：集中加载配置、日志、数据库与所有业务模块。
 * 全局注册 JWT 与认证守卫，默认所有接口都需要登录，除非标记 @Public()。
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || "info",
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { singleLine: true } }
            : undefined,
      },
    }),
    JwtModule.registerAsync({
      global: true,
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET", "change-me"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_ACCESS_EXPIRATION", "15m"),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    RedisModule,
    MetricsModule,
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
    SyncModule,
    AuthModule,
    UsersModule,
    GoalsModule,
    ProjectsModule,
    TasksModule,
    HabitsModule,
    CheckinsModule,
    RemindersModule,
    ReviewsModule,
    AiModule,
    AnalyticsModule,
    TodayModule,
    InboxModule,
    CalendarModule,
    SocialModule,
    ExternalModule,
    ReportsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
