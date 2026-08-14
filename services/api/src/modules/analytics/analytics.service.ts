import { Injectable } from "@nestjs/common";

@Injectable()
export class AnalyticsService {
  track(eventType: string, metadata?: Record<string, unknown>) {
    // Week 0 仅保留埋点接口骨架，后续接入 UserEvent 落库
    return { eventType, metadata, trackedAt: new Date().toISOString() };
  }
}
