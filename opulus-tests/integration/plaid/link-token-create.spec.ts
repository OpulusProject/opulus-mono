import { expect, test } from "@playwright/test";
import { withSession } from "../../backend/helpers/client.js";
import { createAuthedUser } from "../../backend/helpers/fixtures/auth.js";

/**
 * This file: POST /api/plaid/link-token against real Plaid Sandbox.
 *
 * The service creates a Plaid user (if needed) and a Link token by calling
 * Plaid. Auth gating is already covered deterministically in the service-api
 * suite; here we assert the real happy path — a genuine Sandbox link token is
 * returned — which only holds when the backend runs with real Sandbox creds.
 */
test.describe("POST /api/plaid/link-token (Plaid Sandbox)", () => {
  test("returns a real Plaid link token for an authenticated user", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/plaid/link-token", {
      headers: withSession(cookie),
      data: {},
    });

    // Assert
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.linkToken).toEqual(
      expect.stringMatching(/^link-sandbox-/),
    );
  });
});
