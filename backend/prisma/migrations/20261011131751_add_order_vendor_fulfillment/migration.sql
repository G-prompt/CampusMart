-- CreateTable
CREATE TABLE "OrderVendorFulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeCiphertext" TEXT NOT NULL,
    "codeCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "failedAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAttemptAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderVendorFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderVendorFulfillment_orderId_idx" ON "OrderVendorFulfillment"("orderId");

-- CreateIndex
CREATE INDEX "OrderVendorFulfillment_vendorId_idx" ON "OrderVendorFulfillment"("vendorId");

-- CreateIndex
CREATE INDEX "OrderVendorFulfillment_vendorId_verifiedAt_idx" ON "OrderVendorFulfillment"("vendorId", "verifiedAt");

-- CreateIndex
CREATE INDEX "OrderVendorFulfillment_lockedUntil_idx" ON "OrderVendorFulfillment"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "OrderVendorFulfillment_orderId_vendorId_key" ON "OrderVendorFulfillment"("orderId", "vendorId");

-- AddForeignKey
ALTER TABLE "OrderVendorFulfillment" ADD CONSTRAINT "OrderVendorFulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderVendorFulfillment" ADD CONSTRAINT "OrderVendorFulfillment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
