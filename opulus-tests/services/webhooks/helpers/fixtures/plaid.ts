import { type APIRequestContext } from "@playwright/test";

/**
 * Builders for Plaid webhook requests. The receiver accepts a single POST that
 * must carry a Plaid-signed `plaid-verification` JWT (ES256) whose payload hash
 * matches the body. Plaid signs asymmetrically and verification fetches Plaid's
 * public key by `kid`, so a genuinely-accepted webhook can only come from Plaid
 * itself (sandbox delivery to a public URL) — it cannot be forged offline.
 *
 * These builders therefore drive the verification middleware's rejection
 * branches, which is the part of the create path this single service owns and
 * can answer deterministically. The accepted create happy-path (item creation)
 * requires real Plaid and lives outside a black-box CI suite.
 */

const SAMPLE_WEBHOOK_BODY = {
  webhook_type: "TRANSACTIONS",
  webhook_code: "SYNC_UPDATES_AVAILABLE",
  item_id: "test-item",
};

/** POST the webhook with no `plaid-verification` header at all. */
export function postWebhookWithoutSignature(
  request: APIRequestContext,
): ReturnType<APIRequestContext["post"]> {
  return request.post("/webhook/plaid", {
    headers: { "content-type": "application/json" },
    data: SAMPLE_WEBHOOK_BODY,
  });
}

/** POST the webhook with a syntactically invalid `plaid-verification` header. */
export function postWebhookWithMalformedSignature(
  request: APIRequestContext,
  header = "not-a-jwt",
): ReturnType<APIRequestContext["post"]> {
  return request.post("/webhook/plaid", {
    headers: {
      "content-type": "application/json",
      "plaid-verification": header,
    },
    data: SAMPLE_WEBHOOK_BODY,
  });
}

function base64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/**
 * Build a structurally-valid but unsigned JWT with a chosen `alg` header. The
 * receiver decodes the header, sees a non-ES256 alg, and rejects before any
 * signature check — a deterministic, offline way to hit the "Invalid alg" path.
 */
export function fakeJwt(alg = "HS256"): string {
  const header = base64url({ alg, typ: "JWT", kid: "test-kid" });
  const payload = base64url({ request_body_sha256: "deadbeef" });
  return `${header}.${payload}.signature`;
}
