import { test } from "@playwright/test";
import { expectMessageIncludes, expectStatus } from "../helpers/assertions.js";
import {
  fakeJwt,
  postWebhookWithMalformedSignature,
  postWebhookWithoutSignature,
} from "../helpers/fixtures/index.js";

/**
 * This file: the Plaid webhook ingest endpoint — the service's only inbound
 * write surface. Item creation is no longer webhook-driven (handled via the
 * frontend's Link onSuccess → POST /api/plaid/items), so the only paths this
 * service still owns are signature verification (covered deterministically
 * below) and queue dispatch for ITEM / TRANSACTIONS webhooks (requires a
 * genuinely Plaid-signed ES256 payload, out of scope for black-box tests).
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
});
