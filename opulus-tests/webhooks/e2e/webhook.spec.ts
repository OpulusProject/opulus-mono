import { expect, test } from "@playwright/test";
import { expectMessageIncludes, expectStatus } from "./helpers/assertions.js";
import {
  fakeJwt,
  postWebhookWithMalformedSignature,
  postWebhookWithoutSignature,
} from "./helpers/fixtures.js";

/**
 * POST /webhook/plaid — the receiver's only ingest endpoint. Every request must
 * carry a Plaid-signed `plaid-verification` JWT; the verification middleware is
 * the security boundary this service owns, so we cover its rejection branches
 * exhaustively. A genuinely Plaid-signed happy path needs Plaid's ES256 keys and
 * is out of scope for a black-box suite (see helpers/fixtures.ts).
 */

test.describe("POST /webhook/plaid — verification", () => {
  test("rejects a request missing the plaid-verification header (401)", async ({
    request,
  }) => {
    const res = await postWebhookWithoutSignature(request);
    await expectStatus(res, 401);
    await expectMessageIncludes(res, "Missing plaid-verification header");
  });

  test("rejects a malformed verification token (401)", async ({ request }) => {
    const res = await postWebhookWithMalformedSignature(request);
    await expectStatus(res, 401);
    await expectMessageIncludes(res, "Invalid JWT format");
  });

  test("rejects a token that is not signed with ES256 (401)", async ({
    request,
  }) => {
    const res = await postWebhookWithMalformedSignature(request, fakeJwt("HS256"));
    await expectStatus(res, 401);
    await expectMessageIncludes(res, "Invalid alg");
  });

  test("does not accept GET on the webhook route", async ({ request }) => {
    const res = await request.get("/webhook/plaid");
    expect(res.status()).toBe(404);
  });
});
