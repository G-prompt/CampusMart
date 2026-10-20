CREATE TYPE "MarketplaceTargetType" AS ENUM ('user','product','order');
CREATE TYPE "MarketplaceReportCategory" AS ENUM ('suspected_fraud','non_delivery','misleading_listing','harassment','prohibited_item','other');
CREATE TYPE "MarketplaceSeverity" AS ENUM ('low','medium','high','critical');
CREATE TYPE "MarketplaceCaseStatus" AS ENUM ('open','investigating','action_taken','dismissed','closed');
ALTER TABLE "User" ADD COLUMN "accountFlaggedAt" TIMESTAMP(3), ADD COLUMN "accountFlagReason" TEXT, ADD COLUMN "accountSuspendedAt" TIMESTAMP(3), ADD COLUMN "accountSuspensionReason" TEXT, ADD COLUMN "moderationSellerAccessBeforeSuspension" "VendorAccessStatus";
ALTER TABLE "Product" ADD COLUMN "moderationHiddenAt" TIMESTAMP(3), ADD COLUMN "moderationHiddenReason" TEXT;
CREATE TABLE "MarketplaceCase" (
"id" TEXT NOT NULL, "targetType" "MarketplaceTargetType" NOT NULL, "targetId" TEXT NOT NULL,
"universityId" TEXT, "status" "MarketplaceCaseStatus" NOT NULL DEFAULT 'open',
"highestSeverity" "MarketplaceSeverity" NOT NULL DEFAULT 'low',
"reportCount" INTEGER NOT NULL DEFAULT 0, "priorityScore" INTEGER NOT NULL DEFAULT 0,
"lastReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"resolutionNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "MarketplaceCase_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MarketplaceReport" (
"id" TEXT NOT NULL, "caseId" TEXT NOT NULL, "reporterId" TEXT NOT NULL,
"category" "MarketplaceReportCategory" NOT NULL, "severity" "MarketplaceSeverity" NOT NULL,
"details" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "MarketplaceReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketplaceCase_targetType_targetId_key" ON "MarketplaceCase"("targetType","targetId");
CREATE INDEX "MarketplaceCase_status_priorityScore_lastReportedAt_idx" ON "MarketplaceCase"("status","priorityScore","lastReportedAt");
CREATE INDEX "MarketplaceCase_universityId_status_priorityScore_idx" ON "MarketplaceCase"("universityId","status","priorityScore");
CREATE INDEX "MarketplaceCase_targetType_status_idx" ON "MarketplaceCase"("targetType","status");
CREATE UNIQUE INDEX "MarketplaceReport_caseId_reporterId_key" ON "MarketplaceReport"("caseId","reporterId");
CREATE INDEX "MarketplaceReport_reporterId_createdAt_idx" ON "MarketplaceReport"("reporterId","createdAt");
CREATE INDEX "MarketplaceReport_caseId_createdAt_idx" ON "MarketplaceReport"("caseId","createdAt");
CREATE INDEX "OrderVendorFulfillment_verifiedAt_vendorId_idx" ON "OrderVendorFulfillment"("verifiedAt","vendorId");
ALTER TABLE "MarketplaceReport" ADD CONSTRAINT "MarketplaceReport_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MarketplaceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReport" ADD CONSTRAINT "MarketplaceReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
