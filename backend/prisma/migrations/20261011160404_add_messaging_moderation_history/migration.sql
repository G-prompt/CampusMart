-- CreateEnum
CREATE TYPE "MessagingModerationCategory" AS ENUM ('phone_number', 'email', 'external_username', 'external_link', 'bank_details', 'off_platform_payment', 'circumvention');

-- CreateEnum
CREATE TYPE "MessagingModerationAction" AS ENUM ('redacted', 'blocked');

-- CreateEnum
CREATE TYPE "MessagingModerationSeverity" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "messagingRestrictedUntil" TIMESTAMP(3),
ADD COLUMN     "messagingRestrictionReason" TEXT;

-- CreateTable
CREATE TABLE "MessagingModerationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "contextType" "ConversationContextType",
    "categories" "MessagingModerationCategory"[],
    "action" "MessagingModerationAction" NOT NULL,
    "severity" "MessagingModerationSeverity" NOT NULL DEFAULT 'low',
    "strikeWeight" INTEGER NOT NULL DEFAULT 1,
    "warningCode" TEXT,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "restrictionAppliedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessagingModerationEvent_messageId_key" ON "MessagingModerationEvent"("messageId");

-- CreateIndex
CREATE INDEX "MessagingModerationEvent_userId_createdAt_idx" ON "MessagingModerationEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MessagingModerationEvent_conversationId_createdAt_idx" ON "MessagingModerationEvent"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessagingModerationEvent_action_createdAt_idx" ON "MessagingModerationEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "MessagingModerationEvent_severity_createdAt_idx" ON "MessagingModerationEvent"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "MessagingModerationEvent_requiresReview_createdAt_idx" ON "MessagingModerationEvent"("requiresReview", "createdAt");

-- CreateIndex
CREATE INDEX "User_messagingRestrictedUntil_idx" ON "User"("messagingRestrictedUntil");

-- AddForeignKey
ALTER TABLE "MessagingModerationEvent" ADD CONSTRAINT "MessagingModerationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingModerationEvent" ADD CONSTRAINT "MessagingModerationEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingModerationEvent" ADD CONSTRAINT "MessagingModerationEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
