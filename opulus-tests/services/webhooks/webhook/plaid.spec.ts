import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { readWebhookEvents, waitForWebhookEvents } from "../../../shared/fixtures/index.js";
import { expectStatus } from "../../../shared/assertions.js";
import { expectMessageIncludes } from "../helpers/assertions.js";
import {
  fakeJwt,
  postSignedWebhook,
  postWebhookWithMalformedSignature,
  postWebhookWithoutSignature,
} from "../helpers/fixtures/index.js";

/** A webhook of a type the worker does not handle: it is verified, queued and finishes. */
const harmlessEvent = (itemId: string) => ({
  webhook_type: "AUTH",
  webhook_code: "AUTOMATICALLY_VERIFIED",
  item_id: itemId,
});

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

  test("accepts a webhook signed with Plaid's key and hands it to the worker (200)", async ({
    request,
  }) => {
    // Arrange
    const itemId = uniqueId("item");
    const event = harmlessEvent(itemId);

    // Act
    const res = await postSignedWebhook(request, event);

    // Assert: acknowledged, then verified, queued and handled.
    await expectStatus(res, 200);
    expect(await res.json()).toEqual({ received: true });
    const [recorded] = await waitForWebhookEvents(itemId, "processed");
    expect(recorded).toMatchObject({ webhookType: "AUTH", payload: event });
  });

  test("handles a repeat delivery of the same event once", async ({ request }) => {
    // Arrange
    const itemId = uniqueId("item");
    const event = harmlessEvent(itemId);

    // Act: Plaid re-delivers the identical event straight away.
    await postSignedWebhook(request, event);
    await postSignedWebhook(request, event);
    await waitForWebhookEvents(itemId, "processed");

    // Assert: both are acknowledged, one job ran.
    expect(await readWebhookEvents(itemId)).toHaveLength(1);
  });

  test("rejects a body that changed after it was signed (401)", async ({ request }) => {
    const itemId = uniqueId("item");

    const res = await postSignedWebhook(request, harmlessEvent(itemId), {
      bodyAfterSigning: JSON.stringify({ ...harmlessEvent(itemId), webhook_code: "TAMPERED" }),
    });

    await expectStatus(res, 401);
    await expectMessageIncludes(res, "Invalid body hash");
    expect(await readWebhookEvents(itemId)).toEqual([]);
  });

  test("rejects a token signed with a key that is not Plaid's (401)", async ({ request }) => {
    const res = await postSignedWebhook(request, harmlessEvent(uniqueId("item")), { forged: true });

    await expectStatus(res, 401);
    await expectMessageIncludes(res, "Invalid signature");
  });

  test("rejects a token issued more than five minutes ago (401)", async ({ request }) => {
    const sixMinutesAgo = Math.floor(Date.now() / 1000) - 6 * 60;

    const res = await postSignedWebhook(request, harmlessEvent(uniqueId("item")), { issuedAt: sixMinutesAgo });

    await expectStatus(res, 401);
    await expectMessageIncludes(res, "Invalid signature");
  });

  test("rejects a token whose key Plaid has expired (401)", async ({ request }) => {
    const res = await postSignedWebhook(request, harmlessEvent(uniqueId("item")), { key: "expired" });

    await expectStatus(res, 401);
    await expectMessageIncludes(res, "Expired key");
  });

  test("rejects a token naming a key Plaid does not know (401)", async ({ request }) => {
    const res = await postSignedWebhook(request, harmlessEvent(uniqueId("item")), { key: "unknown" });

    await expectStatus(res, 401);
    await expectMessageIncludes(res, "Invalid key ID");
  });

  test("rejects a correctly signed body that is not JSON (400)", async ({ request }) => {
    const res = await postSignedWebhook(request, {}, { rawBody: "not json" });

    await expectStatus(res, 400);
    await expectMessageIncludes(res, "Invalid JSON body");
  });
});
