-- CreateTable
CREATE TABLE "user_profile_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "stats" JSONB NOT NULL,
    "fallback" BOOLEAN NOT NULL,
    "error" TEXT,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_profile_snapshots_userId_refreshedAt_idx" ON "user_profile_snapshots"("userId", "refreshedAt" DESC);

-- AddForeignKey
ALTER TABLE "user_profile_snapshots" ADD CONSTRAINT "user_profile_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
