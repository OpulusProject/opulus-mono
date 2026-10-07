/**
 * Helpers for the webhook receiver end-to-end suite.
 */

import { type APIRequestContext, type TestType } from "@playwright/test";

import { withSession } from "../../shared/client.js";
import { testDb } from "../../shared/db.js";
import {
  createSandboxItem,
  PLAID_SANDBOX_URL,
  type SandboxCredentials,
} from "../backend/helpers/plaidSandbox.js";

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
  const item = await testDb().item.findUniqueOrThrow({
    where: { id: itemId },
    select: { accessToken: true },
  });
  return { itemId, accessToken: item.accessToken };
}

/** An error response from one of Plaid's sandbox endpoints. */
export class SandboxError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    readonly errorCode: string | undefined,
    body: string,
  ) {
    super(`Plaid sandbox ${path} failed (${status}): ${body}`);
  }
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
    const text = await res.text();
    let errorCode: string | undefined;
    try {
      errorCode = (JSON.parse(text) as { error_code?: string }).error_code;
    } catch {
      // Not JSON; the message still carries the body.
    }
    throw new SandboxError(path, res.status, errorCode, text);
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
 * Fire NEW_ACCOUNTS_AVAILABLE, or skip the calling test when the sandbox
 * can't. Plaid only fires it for items created through Link with Account
 * Select v2 enabled, which items minted by /sandbox/public_token/create are
 * not, so today this skips. It starts running if that changes.
 */
export async function fireNewAccountsAvailableOrSkip(
  test: Pick<TestType<never, never>, "skip">,
  creds: SandboxCredentials,
  accessToken: string,
): Promise<void> {
  try {
    await fireSandboxWebhook(creds, accessToken, "ITEM", "NEW_ACCOUNTS_AVAILABLE");
  } catch (error) {
    if (
      error instanceof SandboxError &&
      error.errorCode === "SANDBOX_ACCOUNT_SELECT_V2_NOT_ENABLED"
    ) {
      test.skip(
        true,
        "Plaid only fires NEW_ACCOUNTS_AVAILABLE for items created through Link with Account Select v2; sandbox public tokens don't have it",
      );
    }
    throw error;
  }
}

/** Put the item into ITEM_LOGIN_REQUIRED; Plaid sends the matching error webhook. */
export function resetSandboxLogin(
  creds: SandboxCredentials,
  accessToken: string,
): Promise<void> {
  return postSandbox("/sandbox/item/reset_login", creds, {
    access_token: accessToken,
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
  timeoutMs = 45_000,
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

/** The ids of the user's accounts on one item, as the client lists them. */
export async function readAccountIds(
  request: APIRequestContext,
  cookie: string,
  itemId: string,
): Promise<string[]> {
  const res = await request.get("/api/accounts", {
    headers: withSession(cookie),
  });
  const { data } = (await res.json()) as {
    data: { accounts: Array<{ id: string; connection: { id: string } }> };
  };
  return data.accounts
    .filter((a) => a.connection.id === itemId)
    .map((a) => a.id);
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
      }>;
    };
  };
  const item = data.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`Item ${itemId} not found for the user`);
  return item;
}
