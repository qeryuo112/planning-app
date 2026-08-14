import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * 全局 Redis 模块
 * 提供 ioredis 实例，用于缓存、限流与异步任务状态。
 */
@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CLIENT",
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>(
          "REDIS_URL",
          "redis://localhost:6379/0",
        );
        return new Redis(url, { maxRetriesPerRequest: 3 });
      },
      inject: [ConfigService],
    },
  ],
  exports: ["REDIS_CLIENT"],
})
export class RedisModule {}
