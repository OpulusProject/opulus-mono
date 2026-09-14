import { type APIRequestContext } from "@playwright/test";

/**
 * Builders for webhook requests. The receiver accepts a single POST that must
 * carry a Plaid-signed `plaid-verification` JWT whose payload hash matches the
 * body. We cannot forge Plaid's ES256 signature from a black-box test, so these
 * builders produce the requests needed to exercise the verification middleware's
 * rejection branches (missing header, malformed JWT, wrong algorithm).
 *
 * The happy path — a genuinely Plaid-signed webhook that enqueues a job — can
 * only be covered end-to-end from Plaid's sandbox or a signing harness, which is
 * out of scope for a black-box REST suite and is intentionally not asserted here.
 */

const SAMPLE_WEBHOOK_BODY = {
  webhook_type: "TRANSACTIONS",
  webhook_code: "SYNC_UPDATES_AVAILABLE",
  item_id: "test-item",
};

/** POST the webhook with no `plaid-verification` header at all. */
export async function postWebhookWithoutSignature(
  request: APIRequestContext,
): Promise<ReturnType<APIRequestContext["post"]>> {
  return request.post("/webhook/plaid", {
    headers: { "content-type": "application/json" },
    data: SAMPLE_WEBHOOK_BODY,
  });
}

/** POST the webhook with a syntactically invalid `plaid-verification` header. */
export async function postWebhookWithMalformedSignature(
  request: APIRequestContext,
  header = "not-a-jwt",
): Promise<ReturnType<APIRequestContext["post"]>> {
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
