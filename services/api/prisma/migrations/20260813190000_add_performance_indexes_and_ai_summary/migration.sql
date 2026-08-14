-- CreateIndex
CREATE INDEX "tasks_scheduled_date_idx" ON "tasks"("scheduledDate");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_user_id_status_idx" ON "tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("startAt");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_start_at_idx" ON "calendar_events"("userId", "startAt");

-- CreateIndex
CREATE INDEX "ai_operations_created_at_idx" ON "ai_operations"("createdAt");

-- CreateIndex
CREATE INDEX "checkins_date_idx" ON "checkins"("date");

-- CreateTable
CREATE TABLE "ai_daily_cost_summaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_daily_cost_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_daily_cost_summaries_user_id_date_key" ON "ai_daily_cost_summaries"("userId", "date");

-- CreateIndex
CREATE INDEX "ai_daily_cost_summaries_user_id_date_idx" ON "ai_daily_cost_summaries"("userId", "date");

-- AddForeignKey
ALTER TABLE "ai_daily_cost_summaries" ADD CONSTRAINT "ai_daily_cost_summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
