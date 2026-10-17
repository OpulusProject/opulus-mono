/**
 * Catch-up sync for every (or one) Plaid item: its transactions, and the
 * holdings of its investment accounts.
 *
 * Plaid does not replay webhooks after ~24h, so a long outage leaves items
 * stale until the next nudge. This walks stored cursors via /transactions/sync,
 * pulls the current holdings, and does not depend on the webhook receiver.
 *
 * Local:
 *   pnpm --filter @opulus/webhooks reconcile
 *   pnpm --filter @opulus/webhooks reconcile -- --item <plaidItemId>
 *
 * Railway (see README):
 *   railway run --service <webhooks-service> -- pnpm --filter @opulus/webhooks reconcile
 */
import "dotenv/config";

import {
  assertItemTokenEncryptionKey,
  itemRepository,
  logger,
  prisma,
  syncItemTransactions,
  trySyncItemHoldings,
} from "@opulus/core";

function parseItemFlag(argv: string[]): string | undefined {
  const args = argv.filter((arg) => arg !== "--");
  const flagIndex = args.indexOf("--item");
  if (flagIndex === -1) {
    return undefined;
  }
  const value = args[flagIndex + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("Usage: reconcile [--item <plaidItemId>]");
  }
  return value;
}

async function main(): Promise<void> {
  assertItemTokenEncryptionKey();
  const onlyItem = parseItemFlag(process.argv.slice(2));
  const items = onlyItem
    ? [
        {
          plaidItemId: onlyItem,
          institutionName: null as string | null,
        },
      ]
    : await itemRepository.getAll();

  if (items.length === 0) {
    logger.info("No items to reconcile");
    return;
  }

  logger.info({ item_count: items.length }, "Starting transaction reconcile");

  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const result = await syncItemTransactions({ plaidItemId: item.plaidItemId });
      // Holdings are a bonus (an item without investments has none): the sync
      // never throws, and an item that has no investments is just "unavailable".
      const holdings = await trySyncItemHoldings({
        item: await itemRepository.getByPlaidItemId(item.plaidItemId),
      });
      succeeded += 1;
      logger.info(
        {
          item_id: item.plaidItemId,
          institution: item.institutionName,
          ...result,
          holdings_status: holdings.status,
        },
        "Reconciled item"
      );
    } catch (error) {
      failed += 1;
      logger.error(
        {
          item_id: item.plaidItemId,
          institution: item.institutionName,
          error_message: error instanceof Error ? error.message : String(error),
        },
        "Failed to reconcile item"
      );
    }
  }

  logger.info({ succeeded, failed, item_count: items.length }, "Reconcile finished");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    logger.error(
      { error_message: error instanceof Error ? error.message : String(error) },
      "Reconcile aborted"
    );
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
