import { expect, test } from "@playwright/test";
import { resetPlaidStub, sandboxRequests } from "../../../shared/plaid-stub.js";
import { runWebhooksScript } from "../helpers/script.js";

// NODE_ENV=production makes the logger write plain JSON straight to stdout; its
// developer-friendly output is written by another thread and is lost when the
// script exits right after logging a refusal.
const fire = (args: string[], env: Record<string, string | undefined> = {}) =>
  runWebhooksScript("fire-webhook", args, {
    NODE_ENV: "production",
    PLAID_WEBHOOK_URL: "https://tunnel.example.test/webhook/plaid",
    PLAID_ENV: "sandbox",
    ...env,
  });

/**
 * This file: the fire-webhook script, which a developer runs to have Plaid's
 * sandbox deliver a webhook to a locally running receiver (behind a tunnel)
 * without going through Link. Against the Plaid stub, which remembers what it was
 * asked for and delivers nothing.
 *
 * Test cases:
 * - makes a sandbox item that sends webhooks to PLAID_WEBHOOK_URL, and asks Plaid to fire the code given
 * - fires SYNC_UPDATES_AVAILABLE for the default institution when told nothing
 * - refuses without PLAID_WEBHOOK_URL, outside the sandbox and for a code Plaid does not have, without calling Plaid
 */
test.describe("fire-webhook script", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("makes a sandbox item that sends webhooks to PLAID_WEBHOOK_URL, and asks Plaid to fire the code given", async () => {
    const result = await fire(["--code", "DEFAULT_UPDATE", "--institution", "ins_stub_other"]);

    expect(result.code).toBe(0);
    const [created, fired] = await sandboxRequests();
    expect(created).toMatchObject({
      path: "/sandbox/public_token/create",
      body: { institution_id: "ins_stub_other", options: { webhook: "https://tunnel.example.test/webhook/plaid" } },
    });
    expect(fired).toMatchObject({
      path: "/sandbox/item/fire_webhook",
      body: { webhook_type: "TRANSACTIONS", webhook_code: "DEFAULT_UPDATE" },
    });
    expect(typeof fired!.body.access_token).toBe("string");
  });

  test("fires SYNC_UPDATES_AVAILABLE for the default institution when told nothing", async () => {
    const result = await fire([]);

    expect(result.code).toBe(0);
    const [created, fired] = await sandboxRequests();
    expect(created!.body).toMatchObject({ institution_id: "ins_109508" });
    expect(fired!.body).toMatchObject({ webhook_code: "SYNC_UPDATES_AVAILABLE" });
  });

  test("refuses without PLAID_WEBHOOK_URL, outside the sandbox and for a code Plaid does not have, without calling Plaid", async () => {
    const noUrl = await fire([], { PLAID_WEBHOOK_URL: "" });
    const production = await fire([], { PLAID_ENV: "production" });
    const badCode = await fire(["--code", "NOT_A_CODE"]);

    expect(noUrl.code).not.toBe(0);
    expect(noUrl.output).toContain("PLAID_WEBHOOK_URL is not set");
    expect(production.code).not.toBe(0);
    expect(production.output).toContain("Refusing to run outside of PLAID_ENV=sandbox");
    expect(badCode.code).not.toBe(0);
    expect(badCode.output).toContain("Unknown webhook code");
    expect(badCode.output).toContain("NOT_A_CODE");
    expect(await sandboxRequests()).toEqual([]);
  });
});
