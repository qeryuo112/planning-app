-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aiProvider" TEXT,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiBaseUrl" TEXT,
ADD COLUMN     "aiApiKey" TEXT;
