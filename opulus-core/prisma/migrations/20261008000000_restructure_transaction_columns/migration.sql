-- Plaid's personal finance category becomes real columns instead of a JSON
-- string, the legacy category hierarchy is dropped, location and payment_meta
-- become JSONB, merchant logo/website/payment channel are added, amount stops
-- keeping 30 decimal places, and dateTransacted (never populated) goes.
-- Existing rows keep their other data but have no category or logo until the
-- item is synced again.

-- AlterTable
ALTER TABLE "transaction"
  DROP COLUMN "category",
  DROP COLUMN "categoryId",
  DROP COLUMN "personalFinanceCategory",
  DROP COLUMN "dateTransacted",
  ADD COLUMN "categoryPrimary" TEXT,
  ADD COLUMN "categoryDetailed" TEXT,
  ADD COLUMN "paymentChannel" TEXT,
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "website" TEXT,
  ALTER COLUMN "location" TYPE JSONB USING "location"::jsonb,
  ALTER COLUMN "paymentMeta" TYPE JSONB USING "paymentMeta"::jsonb,
  ALTER COLUMN "amount" TYPE DECIMAL(19,4);

-- CreateIndex
CREATE INDEX "transaction_userId_date_idx" ON "transaction"("userId", "date");
