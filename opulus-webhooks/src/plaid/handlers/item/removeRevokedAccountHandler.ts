import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  accountService,
  AppError,
  itemService,
  logger,
  NotFoundError,
} from "@opulus/core";

/**
 * Handle ITEM USER_ACCOUNT_REVOKED webhooks: the user revoked access to one
 * account at the institution (Plaid currently sends this for a few
 * institutions). Plaid says to delete the data stored for that account, so the
 * account is removed along with its transactions and liabilities. The item and
 * its other accounts are kept.
 * https://plaid.com/docs/api/items/#user_account_revoked
 */
export async function removeRevokedAccountHandler(
  event: PlaidWebhookEvent
): Promise<void> {
  if (!event.item_id) {
    throw new AppError("item_id is required for ITEM webhook", 400);
  }

  if (!event.account_id) {
    // Without the account there is nothing to remove, and retrying won't help.
    logger.warn(
      { plaid_item_id: event.item_id },
      "USER_ACCOUNT_REVOKED webhook had no account_id; ignoring"
    );
    return;
  }

  try {
    const item = await itemService.getByPlaidItemId(event.item_id);
    const removed = await accountService.deleteByProviderAccountIds(item.id, [
      event.account_id,
    ]);

    logger.info(
      {
        item_id: item.id,
        plaid_item_id: event.item_id,
        plaid_account_id: event.account_id,
        accounts_removed: removed,
      },
      "Revoked account removed from USER_ACCOUNT_REVOKED webhook"
    );
  } catch (error) {
    // The user may have disconnected the item before the webhook arrived;
    // retrying would never find it.
    if (error instanceof NotFoundError) {
      logger.warn(
        { plaid_item_id: event.item_id },
        "USER_ACCOUNT_REVOKED webhook for an item we no longer have; ignoring"
      );
      return;
    }
    throw error;
  }
}
