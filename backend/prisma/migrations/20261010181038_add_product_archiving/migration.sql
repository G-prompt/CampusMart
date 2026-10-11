-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_isArchived_createdAt_idx" ON "Product"("isArchived", "createdAt");

-- CreateIndex
CREATE INDEX "Product_vendorId_isArchived_idx" ON "Product"("vendorId", "isArchived");
