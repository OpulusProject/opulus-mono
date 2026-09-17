import { expect, test } from "@playwright/test";
import { expectMessageIncludes, expectStatus } from "../helpers/assertions.js";
import {
  fakeJwt,
  postWebhookWithMalformedSignature,
  postWebhookWithoutSignature,
} from "../helpers/fixtures/index.js";

/**
 * This file: the Plaid webhook ingest endpoint — the service's only inbound
 * write surface. Its accepted create happy-path (item creation) requires a
 * genuinely Plaid-signed webhook (asymmetric ES256, key fetched from Plaid),
 * which cannot be produced offline; that path needs real Plaid and is out of
 * scope for this black-box suite. What this single service owns and can answer
 * deterministically is the verification boundary, covered exhaustively below.
 */
test.describe("POST /webhook/plaid", () => {
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

  test("does not accept GET on the webhook route (404)", async ({ request }) => {
    const res = await request.get("/webhook/plaid");
    expect(res.status()).toBe(404);
  });
});
