-- Project payment schedule + invoice→project link (was in schema, missing from DB)

DO $$ BEGIN
  CREATE TYPE "PaymentStageStatus" AS ENUM ('PLANNED', 'INVOICED', 'PAID', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contractAmount" DECIMAL(65,30);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "taxPercent" DECIMAL(65,30) NOT NULL DEFAULT 18;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE INDEX IF NOT EXISTS "Invoice_projectId_idx" ON "Invoice"("projectId");

DO $$ BEGIN
  ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PaymentStage" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "percent" DECIMAL(65,30) NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "PaymentStageStatus" NOT NULL DEFAULT 'PLANNED',
  "dueDate" TIMESTAMP(3),
  "invoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentStage_invoiceId_key" ON "PaymentStage"("invoiceId");
CREATE INDEX IF NOT EXISTS "PaymentStage_projectId_sortOrder_idx" ON "PaymentStage"("projectId", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "PaymentStage"
    ADD CONSTRAINT "PaymentStage_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentStage"
    ADD CONSTRAINT "PaymentStage_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
