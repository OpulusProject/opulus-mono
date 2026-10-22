/*
  Warnings:

  - You are about to drop the column `closePrice` on the `security` table. All the data in the column will be lost.
  - You are about to drop the column `closePriceAsOf` on the `security` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "security" DROP COLUMN "closePrice",
DROP COLUMN "closePriceAsOf";
