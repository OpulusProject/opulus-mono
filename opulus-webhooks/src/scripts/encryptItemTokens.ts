/**
 * One-off backfill: encrypt Plaid access tokens that are still stored as
 * plaintext.
 *
 * Idempotent. Rows already encrypted (`enc:` prefix) are skipped, so it can be
 * re-run safely, and it never touches anything else. It logs counts only,
 * never a token.
 *
 * Requires ITEM_TOKEN_ENCRYPTION_KEY and DATABASE_URL for the database you
 * mean to change. Check the count with --dry-run first.
 *
 * Local:
 *   pnpm --filter @opulus/webhooks encrypt-item-tokens -- --dry-run
 *   pnpm --filter @opulus/webhooks encrypt-item-tokens
 *
 * Railway (see README):
 *   railway run --service <webhooks-service> -- pnpm --filter @opulus/webhooks encrypt-item-tokens
 */
import "dotenv/config";

import {
  assertItemTokenEncryptionKey,
  itemRepository,
  logger,
  prisma,
} from "@opulus/core";

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  // Fails before touching the database if the key is missing or malformed.
  assertItemTokenEncryptionKey();

  const { legacy, encrypted } = await itemRepository.encryptLegacyAccessTokens({
    dryRun,
  });

  logger.info(
    {
      dry_run: dryRun,
      legacy_plaintext_items: legacy,
      encrypted_items: encrypted,
    },
    dryRun
      ? "Dry run: no changes written"
      : "Encrypted legacy item access tokens"
  );

  // Rows skipped because they changed while we ran: run it again.
  if (!dryRun && encrypted < legacy) {
    logger.warn(
      { skipped_items: legacy - encrypted },
      "Some items changed during the run; run the script again"
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    logger.error(
      { error_message: error instanceof Error ? error.message : String(error) },
      "Encrypt item tokens aborted"
    );
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
