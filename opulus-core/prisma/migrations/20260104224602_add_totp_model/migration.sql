-- AlterTable
ALTER TABLE "user" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "two_factor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT,
    "backupCodes" TEXT,

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_userId_key" ON "two_factor"("userId");

-- AddForeignKey
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
