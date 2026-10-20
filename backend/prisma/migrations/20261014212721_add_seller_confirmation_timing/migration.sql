-- AlterTable
ALTER TABLE "OrderVendorFulfillment" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryDueAt" TIMESTAMP(3);
