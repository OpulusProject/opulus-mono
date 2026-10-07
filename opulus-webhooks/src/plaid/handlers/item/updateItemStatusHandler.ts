import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  itemService,
  logger,
  NotFoundError,
  toItemErrorData,
} from "@opulus/core";

type ItemUpdate = Parameters<typeof itemService.update>[1];

/**
 * The item update that an ITEM webhook calls for.
 *
 * Connection problems are stored in the item's error columns, which the
 * Connections page already reads (it shows a Reconnect action for the codes
 * below). The two "pending" warnings are not errors in Plaid's terms, but they
 * need the same treatment, so they are stored with the webhook code as the
 * error code.
 * https://plaid.com/docs/api/items/#webhooks
 */
function statusUpdateFor(event: PlaidWebhookEvent): ItemUpdate {
  switch (event.webhook_code) {
    case "ERROR":
    case "USER_PERMISSION_REVOKED":
      // Plaid says to keep the item here so the user can re-grant access.
      return toItemErrorData(event.error);

    case "LOGIN_REPAIRED":
      // The item healed without the user going through update mode.
      return toItemErrorData(null);

    case "PENDING_EXPIRATION":
      return {
        ...toItemErrorData({
          error_type: "ITEM_ERROR",
          error_code: "PENDING_EXPIRATION",
          error_message: `Access consent expires on ${event.consent_expiration_time ?? "an upcoming date"}`,
        }),
        consentExpirationTime: event.consent_expiration_time
          ? new Date(event.consent_expiration_time)
          : undefined,
      };

    case "PENDING_DISCONNECT":
      return toItemErrorData({
        error_type: "ITEM_ERROR",
        error_code: "PENDING_DISCONNECT",
        error_message: `Plaid will disconnect this item on ${event.disconnect_time ?? "an upcoming date"}${event.reason ? ` (${event.reason})` : ""}`,
      });

    default:
      throw new AppError(
        `No status update for ITEM webhook code ${event.webhook_code}`,
        500
      );
  }
}

/**
 * Handle ITEM webhooks that change an item's connection status: record the
 * error or warning, or clear it once Plaid reports the item healthy again.
 */
export async function updateItemStatusHandler(
  event: PlaidWebhookEvent
): Promise<void> {
  if (!event.item_id) {
    throw new AppError("item_id is required for ITEM webhook", 400);
  }

  try {
    const item = await itemService.getByPlaidItemId(event.item_id);
    await itemService.update(item.id, statusUpdateFor(event));

    logger.info(
      {
        item_id: item.id,
        plaid_item_id: event.item_id,
        webhook_code: event.webhook_code,
        error_code: event.error?.error_code,
      },
      "Item status updated from ITEM webhook"
    );
  } catch (error) {
    // The user may have disconnected the item before the webhook arrived;
    // retrying would never find it.
    if (error instanceof NotFoundError) {
      logger.warn(
        { plaid_item_id: event.item_id, webhook_code: event.webhook_code },
        "ITEM webhook for an item we no longer have; ignoring"
      );
      return;
    }
    throw error;
  }
}
