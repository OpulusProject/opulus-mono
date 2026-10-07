-- The better-auth table becomes auth_account so that "account" can name the
-- financial accounts table (previously bank_account). Pure renames: no data
-- changes. The auth table goes first to free the name.

-- account -> auth_account
ALTER TABLE "account" RENAME TO "auth_account";
ALTER TABLE "auth_account" RENAME CONSTRAINT "account_pkey" TO "auth_account_pkey";
ALTER TABLE "auth_account" RENAME CONSTRAINT "account_userId_fkey" TO "auth_account_userId_fkey";

-- bank_account -> account
ALTER TABLE "bank_account" RENAME TO "account";
ALTER TABLE "account" RENAME CONSTRAINT "bank_account_pkey" TO "account_pkey";
ALTER TABLE "account" RENAME CONSTRAINT "bank_account_itemId_fkey" TO "account_itemId_fkey";
ALTER TABLE "account" RENAME CONSTRAINT "bank_account_userId_fkey" TO "account_userId_fkey";
ALTER INDEX "bank_account_persistentAccountId_idx" RENAME TO "account_persistentAccountId_idx";
ALTER INDEX "bank_account_providerAccountId_itemId_key" RENAME TO "account_providerAccountId_itemId_key";
