-- AlterTable
ALTER TABLE "item" ADD COLUMN     "transactionCursor" TEXT;

-- CreateTable
CREATE TABLE "transaction" (
    "id" TEXT NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "authorizedDate" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "category" TEXT[],
    "categoryId" TEXT,
    "personalFinanceCategory" TEXT,
    "location" TEXT,
    "paymentMeta" TEXT,
    "isoCurrencyCode" TEXT,
    "unofficialCurrencyCode" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "pendingTransactionId" TEXT,
    "accountOwner" TEXT,
    "transactionCode" TEXT,
    "merchantEntityId" TEXT,
    "checkNumber" TEXT,
    "dateTransacted" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_accountId_idx" ON "transaction"("accountId");

-- CreateIndex
CREATE INDEX "transaction_itemId_idx" ON "transaction"("itemId");

-- CreateIndex
CREATE INDEX "transaction_userId_idx" ON "transaction"("userId");

-- CreateIndex
CREATE INDEX "transaction_date_idx" ON "transaction"("date");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_providerTransactionId_accountId_key" ON "transaction"("providerTransactionId", "accountId");

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "bank_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
