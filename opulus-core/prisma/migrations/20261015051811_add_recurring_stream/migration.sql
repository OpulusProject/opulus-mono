-- CreateTable
CREATE TABLE "recurring_stream" (
    "id" TEXT NOT NULL,
    "plaidStreamId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "merchantName" TEXT,
    "frequency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "firstDate" TIMESTAMP(3) NOT NULL,
    "lastDate" TIMESTAMP(3) NOT NULL,
    "predictedNextDate" TIMESTAMP(3),
    "averageAmount" DECIMAL(65,30) NOT NULL,
    "lastAmount" DECIMAL(65,30) NOT NULL,
    "isoCurrencyCode" TEXT,
    "category" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_stream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_stream_userId_idx" ON "recurring_stream"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_stream_itemId_plaidStreamId_key" ON "recurring_stream"("itemId", "plaidStreamId");

-- AddForeignKey
ALTER TABLE "recurring_stream" ADD CONSTRAINT "recurring_stream_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_stream" ADD CONSTRAINT "recurring_stream_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_stream" ADD CONSTRAINT "recurring_stream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
