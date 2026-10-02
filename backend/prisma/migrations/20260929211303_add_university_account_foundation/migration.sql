/*
  Warnings:

  - A unique constraint covering the columns `[universityId,matricNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StudentVerificationStatus" AS ENUM ('not_started', 'pending', 'verified', 'failed');

-- CreateEnum
CREATE TYPE "VendorVerificationStatus" AS ENUM ('not_started', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "VendorAccessStatus" AS ENUM ('active', 'pending_review', 'restricted', 'suspended');

-- CreateEnum
CREATE TYPE "UniversityVerificationMethod" AS ENUM ('none', 'manual', 'database', 'api');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fallbackCity" TEXT,
ADD COLUMN     "fallbackState" TEXT,
ADD COLUMN     "matricNumber" TEXT,
ADD COLUMN     "studentVerificationStatus" "StudentVerificationStatus" NOT NULL DEFAULT 'not_started',
ADD COLUMN     "studentVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "universityId" TEXT;

-- AlterTable
ALTER TABLE "VendorProfile" ADD COLUMN     "accessStatus" "VendorAccessStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "vendorVerificationStatus" "VendorVerificationStatus" NOT NULL DEFAULT 'not_started',
ADD COLUMN     "vendorVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "verificationSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "logoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "studentVerificationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" "UniversityVerificationMethod" NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "University_slug_key" ON "University"("slug");

-- CreateIndex
CREATE INDEX "University_active_idx" ON "University"("active");

-- CreateIndex
CREATE INDEX "University_state_idx" ON "University"("state");

-- CreateIndex
CREATE INDEX "University_city_idx" ON "University"("city");

-- CreateIndex
CREATE INDEX "User_universityId_idx" ON "User"("universityId");

-- CreateIndex
CREATE INDEX "User_fallbackState_idx" ON "User"("fallbackState");

-- CreateIndex
CREATE INDEX "User_studentVerificationStatus_idx" ON "User"("studentVerificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "User_universityId_matricNumber_key" ON "User"("universityId", "matricNumber");

-- CreateIndex
CREATE INDEX "VendorProfile_accessStatus_idx" ON "VendorProfile"("accessStatus");

-- CreateIndex
CREATE INDEX "VendorProfile_vendorVerificationStatus_idx" ON "VendorProfile"("vendorVerificationStatus");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
