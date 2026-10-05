-- AlterTable
ALTER TABLE "item" ALTER COLUMN "error" TYPE JSONB USING (
  CASE
    WHEN "error" IS NULL THEN NULL
    ELSE "error"::jsonb
  END
);
