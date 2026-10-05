-- AlterTable
ALTER TABLE "item" ADD COLUMN "errorType" TEXT,
ADD COLUMN "errorCode" TEXT,
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "displayMessage" TEXT;

UPDATE "item"
SET
  "errorType" = "error"->>'error_type',
  "errorCode" = "error"->>'error_code',
  "errorMessage" = "error"->>'error_message',
  "displayMessage" = "error"->>'display_message'
WHERE "error" IS NOT NULL;

ALTER TABLE "item" DROP COLUMN "error";
