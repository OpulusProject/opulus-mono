-- CreateTable
CREATE TABLE "plaid_account" (
    "id" TEXT NOT NULL,
    "plaidAccountId" TEXT NOT NULL,
    "persistentAccountId" TEXT,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "mask" TEXT,
    "balanceAvailable" DECIMAL(65,30),
    "balanceCurrent" DECIMAL(65,30),
    "balanceLimit" DECIMAL(65,30),
    "isoCurrencyCode" TEXT,
    "unofficialCurrencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plaid_account_persistentAccountId_idx" ON "plaid_account"("persistentAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_account_plaidAccountId_itemId_key" ON "plaid_account"("plaidAccountId", "itemId");

-- AddForeignKey
ALTER TABLE "plaid_account" ADD CONSTRAINT "plaid_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_account" ADD CONSTRAINT "plaid_account_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
