/**
 * Helpers for the webhook receiver end-to-end suite.
 */

import { type APIRequestContext } from "@playwright/test";

import { withSession } from "../../shared/client.js";
import { readItemAccessToken } from "../../shared/db.js";
import {
  createSandboxItem,
  PLAID_SANDBOX_URL,
  type SandboxCredentials,
} from "../helpers/plaidSandbox.js";

/**
 * Where Plaid should deliver webhooks: the public URL of the receiver under
 * test. Fails loudly when it is not set, since without it nothing would ever
 * arrive and every spec would just time out.
 */
export function requireWebhookUrl(): string {
  const base = process.env.WEBHOOK_PUBLIC_URL;
  if (!base) {
    throw new Error(
      "WEBHOOK_PUBLIC_URL is required: the public URL of the running " +
        "webhooks receiver (e.g. the URL from `pnpm dev:webhooks:tunnel`).",
    );
  }
  return `${base.replace(/\/+$/, "")}/webhook/plaid`;
}

export interface LinkedItem {
  /** Our internal item id. */
  itemId: string;
  /** Plaid's access token, read from the test DB (never exposed over HTTP). */
  accessToken: string;
}

/**
 * Link a sandbox item whose webhooks go to the receiver, and return it with
 * its access token so specs can ask Plaid to fire webhooks at it.
 */
export async function linkItemWithWebhook(
  request: APIRequestContext,
  cookie: string,
  creds: SandboxCredentials,
): Promise<LinkedItem> {
  const { itemId } = await createSandboxItem(
    request,
    cookie,
    creds,
    undefined,
    { webhookUrl: requireWebhookUrl() },
  );
  return { itemId, accessToken: await readItemAccessToken(itemId) };
}

async function postSandbox(
  path: string,
  creds: SandboxCredentials,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${PLAID_SANDBOX_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: creds.clientId,
      secret: creds.secret,
      ...body,
    }),
  });
  if (!res.ok) {
    throw new Error(`Plaid sandbox ${path} failed (${res.status}): ${await res.text()}`);
  }
}

/** Ask Plaid's sandbox to deliver a webhook of this type and code to the item. */
export function fireSandboxWebhook(
  creds: SandboxCredentials,
  accessToken: string,
  webhookType: "ITEM" | "TRANSACTIONS" | "LIABILITIES",
  webhookCode: string,
): Promise<void> {
  return postSandbox("/sandbox/item/fire_webhook", creds, {
    access_token: accessToken,
    webhook_type: webhookType,
    webhook_code: webhookCode,
  });
}

/**
 * Poll until `read` returns a value that satisfies `done`, or time out.
 * Webhooks are delivered and processed asynchronously, so this is how a spec
 * waits for one to take effect.
 */
export async function waitFor<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  what: string,
  timeoutMs = 60_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await read();
    if (done(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${what}; last seen: ${JSON.stringify(last)}`,
  );
}

/** Read the user's item as the client sees it. */
export async function readItem(
  request: APIRequestContext,
  cookie: string,
  itemId: string,
) {
  const res = await request.get("/api/items", { headers: withSession(cookie) });
  const { data } = (await res.json()) as {
    data: {
      items: Array<{
        id: string;
        errorCode: string | null;
        errorType: string | null;
        newAccountsAvailable: boolean;
        syncedAt: string | null;
        accounts: Array<{ liabilityDetails: { syncedAt: string } | null }>;
      }>;
    };
  };
  const item = data.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`Item ${itemId} not found for the user`);
  return item;
}
