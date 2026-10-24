-- AlterTable
ALTER TABLE "security" ADD COLUMN     "dividendCurrency" TEXT,
ADD COLUMN     "dividendRate" DECIMAL(20,6),
ADD COLUMN     "dividendYield" DECIMAL(10,6),
ADD COLUMN     "dividendsFetchedAt" TIMESTAMP(3);
