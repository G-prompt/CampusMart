-- AlterEnum
ALTER TYPE "VerificationAppealStatus" ADD VALUE 'draft';

-- Add the new createdAt column temporarily as nullable.
ALTER TABLE "VerificationAppeal"
ADD COLUMN "createdAt" TIMESTAMP(3);

-- Preserve the historical creation time of existing appeals.
-- All existing appeals were submitted immediately when created
-- under the old flow, so submittedAt is their best creation time.
UPDATE "VerificationAppeal"
SET "createdAt" = COALESCE("submittedAt", CURRENT_TIMESTAMP);

-- Finish the new appeal lifecycle structure.
ALTER TABLE "VerificationAppeal"
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'draft',
ALTER COLUMN "submittedAt" DROP NOT NULL,
ALTER COLUMN "submittedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "VerificationAppeal_createdAt_idx"
ON "VerificationAppeal"("createdAt");