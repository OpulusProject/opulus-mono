import { expect, test } from "@playwright/test";
import { startService, stopService, type RunningService } from "../helpers/service.js";

const PORT = 18300;

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * This file: the receiver without the Plaid credentials it checks webhooks
 * with (outside production it starts anyway; in production it refuses to, see
 * deployment/config). It must say so, and not call a webhook it cannot check
 * invalid.
 *
 * Test cases:
 * - answers 500, saying why, to a webhook it has no credentials to verify
 * - answers 500, not 401, when Plaid cannot be reached for the key
 */
test.describe("webhook receiver without Plaid credentials or reach of Plaid", () => {
  let receiver: RunningService;
  test.afterEach(() => stopService(receiver));

  test("answers 500, saying why, to a webhook it has no credentials to verify", async () => {
    // Arrange
    receiver = await startService({
      workspace: "opulus-webhooks",
      port: PORT,
      portVariable: "WEBHOOK_PORT",
      env: { PLAID_CLIENT_ID: "", PLAID_SECRET: "" },
    });
    // A token that gets as far as needing the key: readable, and signed with ES256 (not checked yet).
    const token = `${base64url({ alg: "ES256", typ: "JWT", kid: "any-key" })}.${base64url({ request_body_sha256: "x" })}.signature`;

    // Act
    const res = await fetch(`http://localhost:${PORT}/webhook/plaid`, {
      method: "POST",
      headers: { "content-type": "application/json", "plaid-verification": token },
      body: JSON.stringify({ webhook_type: "ITEM", webhook_code: "ERROR" }),
    });

    // Assert
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ message: expect.stringContaining("Plaid credentials not configured") });
  });

  test("answers 500, not 401, when Plaid cannot be reached for the key", async () => {
    // Arrange: credentials, but a Plaid address nothing listens on.
    receiver = await startService({
      workspace: "opulus-webhooks",
      port: PORT,
      portVariable: "WEBHOOK_PORT",
      env: { PLAID_BASE_URL: "http://localhost:1" },
    });
    const token = `${base64url({ alg: "ES256", typ: "JWT", kid: "any-key" })}.${base64url({ request_body_sha256: "x" })}.signature`;

    // Act
    const res = await fetch(`http://localhost:${PORT}/webhook/plaid`, {
      method: "POST",
      headers: { "content-type": "application/json", "plaid-verification": token },
      body: JSON.stringify({ webhook_type: "ITEM", webhook_code: "ERROR" }),
    });

    // Assert: Plaid being down is our 500, not a verdict on the webhook.
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ message: "Internal server error", details: expect.any(String) });
  });
});
