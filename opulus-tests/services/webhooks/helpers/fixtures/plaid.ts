import { createHash, createPrivateKey, createSign, generateKeyPairSync } from "node:crypto";
import { type APIRequestContext } from "@playwright/test";
import { webhookSigningKey } from "../../../../shared/plaid-stub.js";

/**
 * Builders for Plaid webhook requests. The receiver accepts a single POST that
 * must carry a Plaid-signed `plaid-verification` JWT (ES256) whose payload hash
 * matches the body, and it fetches Plaid's public key by `kid` to check it.
 *
 * The receiver runs against the Plaid stub (PLAID_BASE_URL), which serves a key
 * of its own and hands the matching private key to the tests. So a test can sign
 * a webhook that the receiver really verifies, and also break the signature in
 * each way the receiver rejects, with no Plaid involved.
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

export interface SignOptions {
  /** Which of the stub's keys to name in the token ("valid" by default). */
  key?: "valid" | "expired" | "unknown";
  /** Sign with a key of the test's own instead of the stub's (a forged token). */
  forged?: boolean;
  /** When the token was issued, seconds since the epoch (now by default). */
  issuedAt?: number;
  /** The body hash to claim (the body's own by default). */
  claimedHash?: string;
}

/** An ES256 JWT as Plaid signs a webhook: the key id in the header, the body's SHA-256 in the payload. */
async function signToken(body: string, options: SignOptions): Promise<string> {
  const stub = await webhookSigningKey();
  const kid = { valid: stub.kid, expired: stub.expiredKid, unknown: "not-a-key-the-stub-knows" }[options.key ?? "valid"];
  const privateKey = options.forged
    ? generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey
    : createPrivateKey({ key: stub.privateJwk as never, format: "jwk" });

  const header = base64url({ alg: "ES256", typ: "JWT", kid });
  const payload = base64url({
    iat: options.issuedAt ?? Math.floor(Date.now() / 1000),
    request_body_sha256: options.claimedHash ?? createHash("sha256").update(body).digest("hex"),
  });
  const signature = createSign("SHA256")
    .update(`${header}.${payload}`)
    .sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * POST a webhook the way Plaid does: the exact bytes that were signed, with the
 * token in `plaid-verification`. `options` breaks the signature on purpose.
 */
export async function postSignedWebhook(
  request: APIRequestContext,
  event: Record<string, unknown>,
  options: SignOptions & { bodyAfterSigning?: string; rawBody?: string } = {},
): ReturnType<APIRequestContext["post"]> {
  const signed = options.rawBody ?? JSON.stringify(event);
  return request.post("/webhook/plaid", {
    headers: {
      "content-type": "application/json",
      "plaid-verification": await signToken(signed, options),
    },
    // Bytes, so the client sends exactly what was signed (it would re-quote a string that is not JSON).
    data: Buffer.from(options.bodyAfterSigning ?? signed),
  });
}
