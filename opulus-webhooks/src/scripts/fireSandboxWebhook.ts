/**
 * Fire a Plaid Sandbox webhook end-to-end without the Link UI.
 *
 * Creates an ephemeral sandbox item, then calls /sandbox/item/fire_webhook so
 * Plaid delivers a real signed webhook to the URL in `PLAID_WEBHOOK_URL`.
 * Useful for iterating on the webhooks service locally behind a zrok/ngrok
 * tunnel without re-doing the Plaid Link flow every time.
 *
 * Usage:
 *   pnpm --filter @opulus/webhooks fire-webhook
 *   pnpm --filter @opulus/webhooks fire-webhook -- --code SYNC_UPDATES_AVAILABLE
 *   pnpm --filter @opulus/webhooks fire-webhook -- --code DEFAULT_UPDATE --institution ins_109508
 *
 * Requires `PLAID_ENV=sandbox` and valid sandbox credentials in the env.
 */
import "../env.js";

import { plaidClient, logger } from "@opulus/core";
import {
  Products,
  SandboxItemFireWebhookRequestWebhookCodeEnum,
  WebhookType,
} from "plaid";

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const webhookUrl = process.env.PLAID_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.error("PLAID_WEBHOOK_URL is not set");
    process.exit(1);
  }
  if ((process.env.PLAID_ENV || "sandbox") !== "sandbox") {
    logger.error("Refusing to run outside of PLAID_ENV=sandbox");
    process.exit(1);
  }

  const institutionId = arg("--institution", "ins_109508");
  const codeArg = arg("--code", "SYNC_UPDATES_AVAILABLE");
  const validCodes = Object.values(
    SandboxItemFireWebhookRequestWebhookCodeEnum,
  ) as string[];
  if (!validCodes.includes(codeArg)) {
    logger.error(
      `Unknown webhook code "${codeArg}". Valid: ${validCodes.join(", ")}`,
    );
    process.exit(1);
  }
  const code = codeArg as SandboxItemFireWebhookRequestWebhookCodeEnum;

  logger.info(
    { webhookUrl, institutionId, code },
    "Firing Plaid sandbox webhook",
  );

  const pub = await plaidClient.sandboxPublicTokenCreate({
    institution_id: institutionId,
    initial_products: [Products.Transactions],
    options: { webhook: webhookUrl },
  });
  const ex = await plaidClient.itemPublicTokenExchange({
    public_token: pub.data.public_token,
  });
  logger.info({ itemId: ex.data.item_id }, "Created ephemeral sandbox item");

  const fire = await plaidClient.sandboxItemFireWebhook({
    access_token: ex.data.access_token,
    webhook_type: WebhookType.Transactions,
    webhook_code: code,
  });
  logger.info(
    { requestId: fire.data.request_id, fired: fire.data.webhook_fired },
    "Webhook fire acknowledged by Plaid",
  );
}

main().catch((err) => {
  logger.error(
    { err: err?.response?.data ?? err?.message ?? String(err) },
    "fire-webhook failed",
  );
  process.exit(1);
});
