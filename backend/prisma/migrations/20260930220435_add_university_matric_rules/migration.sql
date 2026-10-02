-- AlterTable
ALTER TABLE "University" ADD COLUMN     "matricFormatHint" TEXT,
ADD COLUMN     "matricPattern" TEXT,
ADD COLUMN     "matricValidationEnabled" BOOLEAN NOT NULL DEFAULT false;
