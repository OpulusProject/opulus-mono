-- The net worth history: one row per account per completed day (its closing
-- balance). Today's balance is read live from "account", so no row is written
-- for it. A user's or an account's deletion deletes its rows.

-- CreateTable
CREATE TABLE "account_historic_balance" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "balanceCurrent" DECIMAL(19,4) NOT NULL,
    "isoCurrencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_historic_balance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_historic_balance_userId_date_idx" ON "account_historic_balance"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "account_historic_balance_accountId_date_key" ON "account_historic_balance"("accountId", "date");

-- AddForeignKey
ALTER TABLE "account_historic_balance" ADD CONSTRAINT "account_historic_balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_historic_balance" ADD CONSTRAINT "account_historic_balance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

