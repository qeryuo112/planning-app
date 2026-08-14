BEGIN;

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN "source" TEXT;

-- CreateTable
CREATE TABLE "external_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "activityType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER,
    "distanceKm" DOUBLE PRECISION,
    "calories" INTEGER,
    "note" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_activities_userId_startedAt_idx" ON "external_activities"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "external_activities_source_sourceId_idx" ON "external_activities"("source", "sourceId");

-- AddForeignKey
ALTER TABLE "external_activities" ADD CONSTRAINT "external_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
