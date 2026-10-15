import { expect, test } from "@playwright/test";
import { LinkTokenResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import { expectMatchesSchema, expectStatus } from "../../../shared/assertions.js";
import {
  createAuthedUser,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";
import { linkTokenRequests, resetPlaidStub } from "../../../shared/plaid-stub.js";

/**
 * This file: the Plaid link-token create endpoint. Its happy path proxies the
 * external Plaid API, so this suite (single-service, black-box) covers only the
 * boundary the service itself owns and answers deterministically: authentication
 * gating, which runs before any Plaid call.
 */
test.describe("POST /api/link-tokens", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/link-tokens", { data: {} });
    await expectStatus(res, 401);
  });
});

/**
 * The page on the frontend that Plaid sends the user back to after they log in
 * at an OAuth bank. The suite runs the backend with PLAID_REDIRECT_URI set to
 * this (CI and the local runner do), and with PLAID_BASE_URL pointing at the
 * Plaid stub, which remembers what the backend asked for.
 */
const REDIRECT_URI = "http://localhost:5173/oauth-redirect";

/**
 * This file: link tokens, checked through the Plaid stub for what the backend
 * asks Plaid for: the redirect URI that lets OAuth banks send the user back.
 */
test.describe("link tokens and the OAuth redirect URI", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("a new-connection link token asks Plaid for the redirect URI", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/link-tokens", {
      headers: withSession(cookie),
    });

    // Assert: the token comes back, and Plaid was asked to send OAuth users to the page.
    const body = await expectMatchesSchema(res, LinkTokenResponseSchema);
    expect(body.data.linkToken).toMatch(/^link-stub-/);
    const requests = await linkTokenRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      redirect_uri: REDIRECT_URI,
      client_name: "Opulus",
      country_codes: ["CA"],
      user: { client_user_id: userId },
    });
  });

  test("an update-mode link token asks for it too", async ({ request }) => {
    // Arrange: a connection to repair.
    const { cookie, userId } = await createAuthedUser(request);
    const { itemId } = await seedItemWithAccount(userId);

    // Act
    const res = await request.post("/api/link-tokens/update", {
      headers: withSession(cookie),
      data: { itemId, mode: "reconnect" },
    });

    // Assert
    await expectStatus(res, 200);
    const requests = await linkTokenRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ redirect_uri: REDIRECT_URI });
    expect(requests[0]).toHaveProperty("access_token");
  });
});
