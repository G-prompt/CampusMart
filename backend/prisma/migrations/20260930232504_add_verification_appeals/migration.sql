-- CreateEnum
CREATE TYPE "StudentVerificationSource" AS ENUM ('none', 'university_database', 'university_api', 'manual_document_review', 'university_manual_confirmation');

-- CreateEnum
CREATE TYPE "VerificationAppealStatus" AS ENUM ('pending', 'under_review', 'more_information_required', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "VerificationAppealReason" AS ENUM ('record_not_found', 'university_system_unavailable', 'recent_admission_or_transfer', 'integration_error', 'university_not_supported', 'other');

-- CreateEnum
CREATE TYPE "VerificationEvidenceType" AS ENUM ('student_id', 'student_portal', 'institutional_email', 'admission_record', 'other');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fallbackUniversityName" TEXT,
ADD COLUMN     "studentVerificationSource" "StudentVerificationSource" NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "VerificationAppeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT,
    "reason" "VerificationAppealReason" NOT NULL,
    "explanation" TEXT,
    "status" "VerificationAppealStatus" NOT NULL DEFAULT 'pending',
    "submittedName" TEXT NOT NULL,
    "submittedMatricNumber" TEXT,
    "submittedUniversityName" TEXT NOT NULL,
    "submittedState" TEXT,
    "submittedCity" TEXT,
    "decisionReason" TEXT,
    "reviewedByAdminId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationAppealEvidence" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "type" "VerificationEvidenceType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAppealEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationAppeal_userId_idx" ON "VerificationAppeal"("userId");

-- CreateIndex
CREATE INDEX "VerificationAppeal_universityId_idx" ON "VerificationAppeal"("universityId");

-- CreateIndex
CREATE INDEX "VerificationAppeal_status_idx" ON "VerificationAppeal"("status");

-- CreateIndex
CREATE INDEX "VerificationAppeal_submittedAt_idx" ON "VerificationAppeal"("submittedAt");

-- CreateIndex
CREATE INDEX "VerificationAppealEvidence_appealId_idx" ON "VerificationAppealEvidence"("appealId");

-- CreateIndex
CREATE INDEX "VerificationAppealEvidence_type_idx" ON "VerificationAppealEvidence"("type");

-- CreateIndex
CREATE INDEX "User_studentVerificationSource_idx" ON "User"("studentVerificationSource");

-- AddForeignKey
ALTER TABLE "VerificationAppeal" ADD CONSTRAINT "VerificationAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAppeal" ADD CONSTRAINT "VerificationAppeal_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAppealEvidence" ADD CONSTRAINT "VerificationAppealEvidence_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "VerificationAppeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
