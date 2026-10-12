-- Daily reference exchange rates: units of a currency for one euro, one row
-- per currency per published day (the euro is stored as 1). Shared by every
-- user, so no foreign keys. Filled and refreshed by opulus-scheduler.

-- CreateTable
CREATE TABLE "exchange_rate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "perEur" DECIMAL(20,10) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_rate_currency_date_idx" ON "exchange_rate"("currency", "date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_date_currency_key" ON "exchange_rate"("date", "currency");
