import { EventEmitter } from "events";

/**
 * 报表缓存失效事件总线
 * 轻量级内部事件Emitter，用于业务服务通知 ReportsService 清除缓存。
 */
export const reportCacheEvents = new EventEmitter();

export enum ReportCacheEvent {
  INVALIDATE = "reports:invalidate",
}

export function emitReportCacheInvalidation(userId: string): void {
  reportCacheEvents.emit(ReportCacheEvent.INVALIDATE, userId);
}
