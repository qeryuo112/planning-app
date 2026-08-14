-- DropForeignKey
ALTER TABLE "plan_versions" DROP CONSTRAINT "plan_versions_goalId_fkey";

-- AlterTable
ALTER TABLE "plan_versions" ALTER COLUMN "goalId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
