-- CreateEnum
CREATE TYPE "PickupPointType" AS ENUM ('campus', 'hostel_block', 'faculty_building', 'custom');

-- DropIndex
DROP INDEX "MessagingModerationEvent_requiresReview_createdAt_idx";

-- CreateTable
CREATE TABLE "VendorPickupPoint" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" "PickupPointType" NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderVendorPickupSelection" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "pickupPointId" TEXT,
    "type" "PickupPointType" NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderVendorPickupSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorPickupPoint_vendorId_isActive_idx" ON "VendorPickupPoint"("vendorId", "isActive");

-- CreateIndex
CREATE INDEX "VendorPickupPoint_vendorId_createdAt_idx" ON "VendorPickupPoint"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderVendorPickupSelection_vendorId_idx" ON "OrderVendorPickupSelection"("vendorId");

-- CreateIndex
CREATE INDEX "OrderVendorPickupSelection_pickupPointId_idx" ON "OrderVendorPickupSelection"("pickupPointId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderVendorPickupSelection_orderId_vendorId_key" ON "OrderVendorPickupSelection"("orderId", "vendorId");

-- CreateIndex
CREATE INDEX "MessagingModerationEvent_requiresReview_idx" ON "MessagingModerationEvent"("requiresReview");

-- AddForeignKey
ALTER TABLE "VendorPickupPoint" ADD CONSTRAINT "VendorPickupPoint_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderVendorPickupSelection" ADD CONSTRAINT "OrderVendorPickupSelection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderVendorPickupSelection" ADD CONSTRAINT "OrderVendorPickupSelection_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderVendorPickupSelection" ADD CONSTRAINT "OrderVendorPickupSelection_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "VendorPickupPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
