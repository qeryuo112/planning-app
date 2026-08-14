-- AlterTable
ALTER TABLE "plan_versions" ADD COLUMN "planDuration" INTEGER;
ALTER TABLE "plan_versions" ADD COLUMN "stageLength" INTEGER;
ALTER TABLE "plan_versions" ADD COLUMN "currentStage" INTEGER;
ALTER TABLE "plan_versions" ADD COLUMN "totalStages" INTEGER;
