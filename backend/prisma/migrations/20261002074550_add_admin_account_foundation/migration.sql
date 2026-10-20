-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'verification_officer', 'university_manager', 'marketplace_moderator', 'customer_support', 'disputes', 'finance', 'technical_admin');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Admin_role_idx" ON "Admin"("role");

-- CreateIndex
CREATE INDEX "Admin_active_idx" ON "Admin"("active");

-- CreateIndex
CREATE INDEX "Admin_createdByAdminId_idx" ON "Admin"("createdByAdminId");

-- CreateIndex
CREATE INDEX "VerificationAppeal_reviewedByAdminId_idx" ON "VerificationAppeal"("reviewedByAdminId");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAppeal" ADD CONSTRAINT "VerificationAppeal_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
