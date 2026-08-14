import { Global, Module } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * 全局 Prisma 模块
 * 使用 @Global 装饰器让各业务模块无需重复导入即可注入 PrismaClient。
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      useValue: new PrismaClient({
        log:
          process.env.NODE_ENV === "development"
            ? ["query", "info", "warn", "error"]
            : ["error"],
      }),
    },
  ],
  exports: [PrismaClient],
})
export class PrismaModule {}
