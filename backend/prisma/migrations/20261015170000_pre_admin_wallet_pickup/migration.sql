-- Checkout privacy and idempotency.
ALTER TABLE "Order" ADD COLUMN "secondaryPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "checkoutKey" TEXT;
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");
ALTER TABLE "OrderVendorFulfillment" ADD COLUMN "readyAt" TIMESTAMP(3);
ALTER TYPE "NotificationType" ADD VALUE 'order_ready';
CREATE TYPE "WalletEntryKind" AS ENUM ('checkout_debit','seller_refund','service_fee_refund','seller_settlement','development_funding');
CREATE TYPE "WalletHoldStatus" AS ENUM ('held','refunded','settled');
CREATE TABLE "Wallet" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "reference" TEXT NOT NULL,
    "kind" "WalletEntryKind" NOT NULL, "amount" INTEGER NOT NULL,
    "orderId" TEXT, "vendorId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WalletEntry_reference_key" ON "WalletEntry"("reference");
CREATE INDEX "WalletEntry_userId_createdAt_idx" ON "WalletEntry"("userId", "createdAt");
CREATE INDEX "WalletEntry_orderId_idx" ON "WalletEntry"("orderId");
CREATE TABLE "WalletHold" (
    "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "vendorId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL, "status" "WalletHoldStatus" NOT NULL DEFAULT 'held',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WalletHold_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WalletHold_orderId_vendorId_key" ON "WalletHold"("orderId", "vendorId");
CREATE INDEX "WalletHold_vendorId_status_idx" ON "WalletHold"("vendorId", "status");
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_balance_nonnegative" CHECK ("balance" >= 0);
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletHold" ADD CONSTRAINT "WalletHold_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
