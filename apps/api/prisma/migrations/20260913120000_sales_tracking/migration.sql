-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "salesPersonId" TEXT;

-- AlterTable
ALTER TABLE "ServiceSubscription" ADD COLUMN "soldById" TEXT;
ALTER TABLE "ServiceSubscription" ADD COLUMN "soldAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Organization_salesPersonId_idx" ON "Organization"("salesPersonId");

-- CreateIndex
CREATE INDEX "ServiceSubscription_soldById_idx" ON "ServiceSubscription"("soldById");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSubscription" ADD CONSTRAINT "ServiceSubscription_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
