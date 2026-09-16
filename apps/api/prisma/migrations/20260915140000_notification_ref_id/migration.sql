-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "refId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_type_refId_idx" ON "Notification"("type", "refId");
