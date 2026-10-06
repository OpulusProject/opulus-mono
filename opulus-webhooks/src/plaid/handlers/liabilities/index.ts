import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { AppError, itemService, liabilityService, logger } from "@opulus/core";

/**
 * Handle LIABILITIES webhook events
 */
export async function handleLiabilitiesWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "DEFAULT_UPDATE":
      await handleDefaultUpdate(event);
      break;
    default:
      logger.warn(
        {
          webhook_code: event.webhook_code,
          webhook_type: event.webhook_type,
          item_id: event.item_id,
        },
        "Unhandled LIABILITIES webhook code"
      );
      break;
  }
}

/**
 * DEFAULT_UPDATE: Plaid detected new or updated liabilities on an item. Fetch
 * the fresh data for the accounts it lists. If the update carries an error,
 * Plaid could not refresh, so there is nothing new to fetch.
 * https://plaid.com/docs/api/products/liabilities/#default_update
 */
async function handleDefaultUpdate(event: PlaidWebhookEvent): Promise<void> {
  if (!event.item_id) {
    throw new AppError("item_id is required for LIABILITIES webhook", 400);
  }

  if (event.error) {
    logger.warn(
      {
        plaid_item_id: event.item_id,
        error_type: event.error.error_type,
        error_code: event.error.error_code,
      },
      "LIABILITIES DEFAULT_UPDATE reported an error; skipping sync"
    );
    return;
  }

  const newAccountIds = event.account_ids_with_new_liabilities ?? [];
  const updatedFields = event.account_ids_with_updated_liabilities ?? {};
  // An empty list means "everything"; Plaid normally lists the affected accounts.
  const providerAccountIds = [
    ...new Set([...newAccountIds, ...Object.keys(updatedFields)]),
  ];

  const item = await itemService.getByPlaidItemId(event.item_id);
  const result = await liabilityService.syncForItem(item, {
    providerAccountIds,
  });

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: event.item_id,
      accounts_new: newAccountIds.length,
      accounts_updated: Object.keys(updatedFields).length,
      updated_fields: updatedFields,
      ...result,
    },
    "Liabilities synced from DEFAULT_UPDATE webhook"
  );
}
