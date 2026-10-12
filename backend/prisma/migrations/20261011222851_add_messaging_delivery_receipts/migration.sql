-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "buyerLastDeliveredAt" TIMESTAMP(3),
ADD COLUMN     "vendorLastDeliveredAt" TIMESTAMP(3);
