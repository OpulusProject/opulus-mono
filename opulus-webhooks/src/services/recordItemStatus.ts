import { itemRepository, logger, toItemErrorData } from "@opulus/core";

/** The ITEM webhook codes that change what we store about an item's status. */
export type ItemStatusWebhookCode =
  | "ERROR"
  | "USER_PERMISSION_REVOKED"
  | "NEW_ACCOUNTS_AVAILABLE"
  | "LOGIN_REPAIRED"
  | "PENDING_EXPIRATION"
  | "PENDING_DISCONNECT";

/** The error Plaid attaches to a webhook, if any. */
type PlaidWebhookError = Parameters<typeof toItemErrorData>[0];

export interface RecordItemStatusParams {
  /** Plaid's id for the item (not ours). */
  plaidItemId: string;
  webhookCode: ItemStatusWebhookCode;
  /** From the ERROR and USER_PERMISSION_REVOKED webhooks. */
  error?: PlaidWebhookError;
  /** From PENDING_EXPIRATION: when access consent expires (ISO timestamp). */
  consentExpirationTime?: string;
  /** From PENDING_DISCONNECT: when Plaid will disconnect the item (ISO timestamp). */
  disconnectTime?: string;
  /** From PENDING_DISCONNECT: why. */
  reason?: string;
}

type ItemUpdate = Parameters<typeof itemRepository.update>[1];

/**
 * The item update that a status webhook calls for.
 *
 * NEW_ACCOUNTS_AVAILABLE only flags the item. Plaid does not return the new
 * accounts from /accounts/get until the user shares them in update mode, so
 * there is nothing to fetch yet; the Connections page prompts the user, and
 * updateItemAccounts picks the accounts up once they have.
 *
 * Connection problems are stored in the item's error columns, which the
 * Connections page already reads (it shows a Reconnect action for the codes
 * below). The two "pending" warnings are not errors in Plaid's terms, but they
 * need the same treatment, so they are stored with the webhook code as the
 * error code.
 * https://plaid.com/docs/api/items/#webhooks
 */
function statusUpdateFor(params: RecordItemStatusParams): ItemUpdate {
  switch (params.webhookCode) {
    case "ERROR":
    case "USER_PERMISSION_REVOKED":
      // Plaid says to keep the item here so the user can re-grant access.
      return toItemErrorData(params.error);

    case "NEW_ACCOUNTS_AVAILABLE":
      return { newAccountsAvailable: true };

    case "LOGIN_REPAIRED":
      // The item healed without the user going through update mode.
      return toItemErrorData(null);

    case "PENDING_EXPIRATION":
      return {
        ...toItemErrorData({
          error_type: "ITEM_ERROR",
          error_code: "PENDING_EXPIRATION",
          error_message: `Access consent expires on ${params.consentExpirationTime ?? "an upcoming date"}`,
        }),
        consentExpirationTime: params.consentExpirationTime
          ? new Date(params.consentExpirationTime)
          : undefined,
      };

    case "PENDING_DISCONNECT":
      return toItemErrorData({
        error_type: "ITEM_ERROR",
        error_code: "PENDING_DISCONNECT",
        error_message: `Plaid will disconnect this item on ${params.disconnectTime ?? "an upcoming date"}${params.reason ? ` (${params.reason})` : ""}`,
      });
  }
}

/**
 * Record a change to an item's connection status that Plaid reported by
 * webhook: store the error, warning or new-accounts flag, or clear the error
 * once Plaid reports the item healthy again.
 *
 * @throws NotFoundError if we have no such item
 */
export async function recordItemStatus(
  params: RecordItemStatusParams
): Promise<void> {
  const item = await itemRepository.getByPlaidItemId(params.plaidItemId);
  await itemRepository.update(item.id, statusUpdateFor(params));

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: params.plaidItemId,
      webhook_code: params.webhookCode,
      error_code: params.error?.error_code,
    },
    "Item status updated from ITEM webhook"
  );
}
