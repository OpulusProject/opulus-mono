-- CreateTable
CREATE TABLE "account_liability" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "isOverdue" BOOLEAN,
    "nextPaymentDueDate" TIMESTAMP(3),
    "minimumPayment" DECIMAL(65,30),
    "lastPaymentAmount" DECIMAL(65,30),
    "lastPaymentDate" TIMESTAMP(3),
    "lastStatementBalance" DECIMAL(65,30),
    "lastStatementIssueDate" TIMESTAMP(3),
    "interestRate" DECIMAL(65,30),
    "originationDate" TIMESTAMP(3),
    "originationPrincipal" DECIMAL(65,30),
    "maturityDate" TIMESTAMP(3),
    "aprs" JSONB,
    "details" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_liability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_liability_accountId_key" ON "account_liability"("accountId");

-- CreateIndex
CREATE INDEX "account_liability_itemId_idx" ON "account_liability"("itemId");

-- CreateIndex
CREATE INDEX "account_liability_userId_idx" ON "account_liability"("userId");

-- AddForeignKey
ALTER TABLE "account_liability" ADD CONSTRAINT "account_liability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_liability" ADD CONSTRAINT "account_liability_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_liability" ADD CONSTRAINT "account_liability_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "bank_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
