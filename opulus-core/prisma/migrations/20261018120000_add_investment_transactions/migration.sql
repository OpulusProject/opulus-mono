-- AlterTable
ALTER TABLE "item" ADD COLUMN     "investmentTransactionsSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "security" ADD COLUMN     "bondFaceValue" DECIMAL(65,30),
ADD COLUMN     "bondIssueDate" TIMESTAMP(3),
ADD COLUMN     "bondMaturityDate" TIMESTAMP(3),
ADD COLUMN     "bondYieldRate" DECIMAL(65,30),
ADD COLUMN     "bondYieldType" TEXT,
ADD COLUMN     "marketIdentifierCode" TEXT,
ADD COLUMN     "optionContractType" TEXT,
ADD COLUMN     "optionExpirationDate" TIMESTAMP(3),
ADD COLUMN     "optionStrikePrice" DECIMAL(65,30),
ADD COLUMN     "optionUnderlyingTicker" TEXT,
ADD COLUMN     "unofficialCurrencyCode" TEXT;

-- CreateTable
CREATE TABLE "investment_transaction" (
    "id" TEXT NOT NULL,
    "plaidInvestmentTransactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "securityId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "quantity" DECIMAL(65,30),
    "price" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL,
    "fees" DECIMAL(65,30),
    "isoCurrencyCode" TEXT,
    "unofficialCurrencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "investment_transaction_plaidInvestmentTransactionId_key" ON "investment_transaction"("plaidInvestmentTransactionId");

-- CreateIndex
CREATE INDEX "investment_transaction_userId_date_idx" ON "investment_transaction"("userId", "date");

-- CreateIndex
CREATE INDEX "investment_transaction_accountId_date_idx" ON "investment_transaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "investment_transaction_itemId_idx" ON "investment_transaction"("itemId");

-- AddForeignKey
ALTER TABLE "investment_transaction" ADD CONSTRAINT "investment_transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transaction" ADD CONSTRAINT "investment_transaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transaction" ADD CONSTRAINT "investment_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transaction" ADD CONSTRAINT "investment_transaction_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "security"("id") ON DELETE SET NULL ON UPDATE CASCADE;

