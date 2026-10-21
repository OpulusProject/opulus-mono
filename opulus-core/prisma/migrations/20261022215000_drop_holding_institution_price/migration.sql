/*
  Warnings:

  - You are about to drop the column `institutionPrice` on the `holding` table. All the data in the column will be lost.
  - You are about to drop the column `institutionPriceAsOf` on the `holding` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "holding" DROP COLUMN "institutionPrice",
DROP COLUMN "institutionPriceAsOf";
