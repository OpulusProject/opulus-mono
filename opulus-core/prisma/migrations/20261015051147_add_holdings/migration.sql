-- CreateTable
CREATE TABLE "security" (
    "id" TEXT NOT NULL,
    "plaidSecurityId" TEXT NOT NULL,
    "name" TEXT,
    "tickerSymbol" TEXT,
    "type" TEXT,
    "isCashEquivalent" BOOLEAN NOT NULL DEFAULT false,
    "isoCurrencyCode" TEXT,
    "closePrice" DECIMAL(65,30),
    "closePriceAsOf" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "institutionPrice" DECIMAL(65,30) NOT NULL,
    "institutionPriceAsOf" TIMESTAMP(3),
    "institutionValue" DECIMAL(65,30) NOT NULL,
    "costBasis" DECIMAL(65,30),
    "isoCurrencyCode" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "security_plaidSecurityId_key" ON "security"("plaidSecurityId");

-- CreateIndex
CREATE INDEX "holding_itemId_idx" ON "holding"("itemId");

-- CreateIndex
CREATE INDEX "holding_userId_idx" ON "holding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "holding_accountId_securityId_key" ON "holding"("accountId", "securityId");

-- AddForeignKey
ALTER TABLE "holding" ADD CONSTRAINT "holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding" ADD CONSTRAINT "holding_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "security"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding" ADD CONSTRAINT "holding_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding" ADD CONSTRAINT "holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
