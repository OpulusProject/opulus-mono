/**
 * Plaid Sandbox helpers for the backend integration suite.
 *
 * Specs that drive the real Plaid-proxying endpoints need a Plaid-issued
 * public_token (and, for refresh/update-accounts, a persisted sandbox-backed
 * Item). The sandbox endpoint `/sandbox/public_token/create` mints a
 * public_token without going through Link's UI and requires real sandbox
 * credentials (NOT the `ci-test` dummies the service suite CI job uses).
 *
 * Design: tests opt in via `requireSandboxCredentials()`, which returns the
 * creds or `test.skip()`s the current test. Keeps the suite green in
 * environments where no secrets are provided and lights up full validation
 * when `PLAID_SANDBOX_CLIENT_ID` + `PLAID_SANDBOX_SECRET` are set.
 */

import { test, type APIRequestContext } from "@playwright/test";

import { expectStatus } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";

export const PLAID_SANDBOX_URL = "https://sandbox.plaid.com";

/** Default sandbox institution used by Plaid docs/examples. */
export const DEFAULT_SANDBOX_INSTITUTION_ID = "ins_109508"; // "First Platypus Bank"

export interface SandboxCredentials {
  clientId: string;
  secret: string;
}

/**
 * Returns sandbox credentials from env, or marks the current test as skipped.
 * Call at the top of each sandbox-touching test.
 */
export function requireSandboxCredentials(): SandboxCredentials {
  const clientId = process.env.PLAID_SANDBOX_CLIENT_ID;
  const secret = process.env.PLAID_SANDBOX_SECRET;

  if (!clientId || !secret || clientId === "ci-test" || secret === "ci-test") {
    test.skip(
      true,
      "PLAID_SANDBOX_CLIENT_ID / PLAID_SANDBOX_SECRET not configured; " +
        "skipping Plaid Sandbox round-trip test.",
    );
    // test.skip throws, so this is unreachable, but TS wants a return.
    throw new Error("unreachable");
  }

  return { clientId, secret };
}

/**
 * Mint a Plaid Sandbox public_token for the given institution. One-shot;
 * the token is consumed on exchange and can only be exchanged once.
 */
export async function createSandboxPublicToken(
  creds: SandboxCredentials,
  institutionId: string = DEFAULT_SANDBOX_INSTITUTION_ID,
): Promise<string> {
  const res = await fetch(`${PLAID_SANDBOX_URL}/sandbox/public_token/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: creds.clientId,
      secret: creds.secret,
      institution_id: institutionId,
      initial_products: ["transactions"],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Plaid sandbox /sandbox/public_token/create failed (${res.status}): ${body}`,
    );
  }

  const data = (await res.json()) as { public_token?: string };
  if (!data.public_token) {
    throw new Error("Plaid sandbox response had no public_token");
  }
  return data.public_token;
}

export interface CreatedSandboxItem {
  /** Our internal item id (what update-accounts / link-token/update take). */
  itemId: string;
}

/**
 * End-to-end: mint a sandbox public_token, exchange it through the backend's
 * POST /api/plaid/items, and return the resulting item id. Used by specs that
 * need a persisted sandbox-backed Item before exercising a downstream endpoint
 * (update-accounts, link-token/update, transactions/refresh).
 *
 * Fresh item per test — slower than a shared fixture, but a single failure is
 * debuggable without reconstructing shared state.
 */
export async function createSandboxItem(
  request: APIRequestContext,
  cookie: string,
  creds: SandboxCredentials,
  institutionId: string = DEFAULT_SANDBOX_INSTITUTION_ID,
): Promise<CreatedSandboxItem> {
  const publicToken = await createSandboxPublicToken(creds, institutionId);
  const res = await request.post("/api/plaid/items", {
    headers: withSession(cookie),
    data: { publicToken, institutionId },
  });
  await expectStatus(res, 201);
  const body = (await res.json()) as {
    data: { itemId: string; duplicate: boolean };
  };
  return { itemId: body.data.itemId };
}
