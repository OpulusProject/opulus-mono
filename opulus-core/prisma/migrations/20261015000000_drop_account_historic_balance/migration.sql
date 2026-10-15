-- The net worth history is no longer stored: a past day's balance is worked out
-- from an account's live balance and its posted transactions. The table held
-- only values derived from those, so nothing is lost.

-- DropForeignKey
ALTER TABLE "account_historic_balance" DROP CONSTRAINT "account_historic_balance_accountId_fkey";

-- DropForeignKey
ALTER TABLE "account_historic_balance" DROP CONSTRAINT "account_historic_balance_userId_fkey";

-- DropTable
DROP TABLE "account_historic_balance";
