-- Campus catalogue metadata: listing is not seller-verification permission.
CREATE TYPE "InstitutionKind" AS ENUM ('university', 'polytechnic', 'other');
CREATE TYPE "RosterScope" AS ENUM ('unspecified', 'institution', 'faculty', 'department');
CREATE TYPE "SellerBadgeKind" AS ENUM ('rising_star', 'campus_favourite', 'top_seller');
ALTER TABLE "University" ADD COLUMN "institutionKind" "InstitutionKind" NOT NULL DEFAULT 'university',
  ADD COLUMN "featuredInSignup" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sellerApplicationsOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UniversityRosterImport" ADD COLUMN "rosterScope" "RosterScope" NOT NULL DEFAULT 'unspecified',
  ADD COLUMN "sourceUnit" TEXT,
  ADD COLUMN "trustedForAutomatedVerification" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "SellerBadgeAward" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "vendorId" TEXT NOT NULL,
  "kind" "SellerBadgeKind" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT NOT NULL,
  "grantedByAdminId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerBadgeAward_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SellerBadgeAward_grantedByAdminId_fkey" FOREIGN KEY ("grantedByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SellerBadgeAward_vendorId_kind_key" ON "SellerBadgeAward"("vendorId", "kind");
CREATE INDEX "SellerBadgeAward_kind_active_idx" ON "SellerBadgeAward"("kind", "active");
CREATE INDEX "SellerBadgeAward_vendorId_active_idx" ON "SellerBadgeAward"("vendorId", "active");
-- Existing university links and old rosters remain unchanged and untrusted by default.

-- Preserve existing open seller onboarding where student verification was already available.
UPDATE "University" SET "sellerApplicationsOpen" = true WHERE "studentVerificationEnabled" = true AND "active" = true;
