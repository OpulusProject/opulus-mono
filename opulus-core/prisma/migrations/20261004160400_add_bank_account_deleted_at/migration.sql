-- AlterTable
ALTER TABLE "bank_account" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bank_account_deletedAt_idx" ON "bank_account"("deletedAt");
