import { expect, test } from "@playwright/test";
import { LinkTokenResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import { expectMatchesSchema, expectStatus } from "../../../shared/assertions.js";
import {
  createAuthedUser,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";
import {
  linkTokenRequests,
  omitPlaidUserToken,
  plaidUserCreateCount,
  resetPlaidStub,
} from "../../../shared/plaid-stub.js";

/**
 * This file: the Plaid link-token create endpoint. Its happy path proxies the
 * external Plaid API, so this suite (single-service, black-box) covers only the
 * boundary the service itself owns and answers deterministically: authentication
 * gating, which runs before any Plaid call.
 */
test.describe("POST /api/link-tokens", () => {
});

/**
 * The page on the frontend that Plaid sends the user back to after they log in
 * at an OAuth bank. The suite runs the backend with PLAID_REDIRECT_URI set to
 * this (CI and the local runner do), and with PLAID_BASE_URL pointing at the
 * Plaid stub, which remembers what the backend asked for.
 */
const REDIRECT_URI = "http://localhost:5173/settings/connections";

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

  test("a new-connection link token asks only for the products we use", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    await request.post("/api/link-tokens", { headers: withSession(cookie) });

    // Assert: transactions (two years of them), and liabilities and investments where supported;
    // no Assets, which nothing reads and which would hide institutions.
    const [requested] = await linkTokenRequests();
    expect(requested).toMatchObject({
      products: ["transactions"],
      required_if_supported_products: ["liabilities", "investments"],
      transactions: { days_requested: 730 },
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

/**
 * This file: how the backend identifies the user to Plaid. Integrations created
 * before 2025-12-10 get a user token from /user/create; later ones get only a
 * user ID, which /link/token/create takes in its place.
 */
test.describe("link tokens and the Plaid user", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("a user Plaid gives a user token to sends that token", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    await request.post("/api/link-tokens", { headers: withSession(cookie) });

    // Assert
    const [requested] = await linkTokenRequests();
    expect(requested.user_token).toMatch(/^stub-user-token-/);
    expect(requested).not.toHaveProperty("user_id");
  });

  test("a user Plaid gives no user token to gets link tokens by user ID", async ({
    request,
  }) => {
    // Arrange: Plaid answers /user/create with a user ID only.
    await omitPlaidUserToken();
    const { cookie } = await createAuthedUser(request);

    // Act: link twice, as a user connecting a second bank would.
    const first = await request.post("/api/link-tokens", { headers: withSession(cookie) });
    const second = await request.post("/api/link-tokens", { headers: withSession(cookie) });

    // Assert: both succeed with the same Plaid user ID, which is created once.
    await expectMatchesSchema(first, LinkTokenResponseSchema);
    await expectMatchesSchema(second, LinkTokenResponseSchema);
    const requests = await linkTokenRequests();
    expect(requests).toHaveLength(2);
    expect(requests[0].user_id).toMatch(/^stub-user-/);
    expect(requests[1].user_id).toBe(requests[0].user_id);
    expect(requests[0]).not.toHaveProperty("user_token");
    expect(await plaidUserCreateCount()).toBe(1);
  });
});
