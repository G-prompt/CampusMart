-- CreateEnum
CREATE TYPE "UniversityVerificationSourceType" AS ENUM ('none', 'university_api', 'roster_import', 'university_database');

-- AlterEnum
ALTER TYPE "StudentVerificationSource" ADD VALUE 'university_roster_import';

-- AlterTable
ALTER TABLE "University" ADD COLUMN     "fallbackVerificationSource" "UniversityVerificationSourceType" NOT NULL DEFAULT 'none',
ADD COLUMN     "manualReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primaryVerificationSource" "UniversityVerificationSourceType" NOT NULL DEFAULT 'none';

-- CreateIndex
CREATE INDEX "University_primaryVerificationSource_idx" ON "University"("primaryVerificationSource");

-- CreateIndex
CREATE INDEX "University_fallbackVerificationSource_idx" ON "University"("fallbackVerificationSource");
