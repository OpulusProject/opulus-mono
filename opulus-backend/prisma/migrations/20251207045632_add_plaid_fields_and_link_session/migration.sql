/*
  Warnings:

  - A unique constraint covering the columns `[plaidId]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[plaidUserToken]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "plaidId" TEXT,
ADD COLUMN     "plaidUserToken" TEXT;

-- CreateTable
CREATE TABLE "link_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "link_session_linkToken_key" ON "link_session"("linkToken");

-- CreateIndex
CREATE UNIQUE INDEX "user_plaidId_key" ON "user"("plaidId");

-- CreateIndex
CREATE UNIQUE INDEX "user_plaidUserToken_key" ON "user"("plaidUserToken");

-- AddForeignKey
ALTER TABLE "link_session" ADD CONSTRAINT "link_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
