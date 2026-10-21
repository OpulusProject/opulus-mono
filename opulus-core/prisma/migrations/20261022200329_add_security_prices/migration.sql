-- AlterTable
ALTER TABLE "security" ADD COLUMN     "priceBackfilledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "security_price" (
    "id" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close" DECIMAL(20,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_price_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_price_date_idx" ON "security_price"("date");

-- CreateIndex
CREATE UNIQUE INDEX "security_price_securityId_date_key" ON "security_price"("securityId", "date");

-- AddForeignKey
ALTER TABLE "security_price" ADD CONSTRAINT "security_price_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "security"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
