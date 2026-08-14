import { Module } from "@nestjs/common";
import { ExternalController } from "./external.controller";
import { ExternalService } from "./external.service";
import { SyncModule } from "../sync/sync.module";

@Module({
  imports: [SyncModule],
  controllers: [ExternalController],
  providers: [ExternalService],
})
export class ExternalModule {}
