import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { logger } from "@opulus/core";
import { skipWhenItemIsGone } from "../skipWhenItemIsGone.js";
import { syncInvestmentTransactionsHandler } from "./syncInvestmentTransactionsHandler.js";

/**
 * Handle INVESTMENTS_TRANSACTIONS webhook events
 */
export async function handleInvestmentsTransactionsWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "DEFAULT_UPDATE":
    case "HISTORICAL_UPDATE":
      await skipWhenItemIsGone(event, () =>
        syncInvestmentTransactionsHandler(event)
      );
      break;
    default:
      logger.warn(
        {
          webhook_code: event.webhook_code,
          webhook_type: event.webhook_type,
          item_id: event.item_id,
        },
        "Unhandled INVESTMENTS_TRANSACTIONS webhook code"
      );
      break;
  }
}
