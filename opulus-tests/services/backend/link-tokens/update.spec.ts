import { expect, test } from "@playwright/test";
import { LinkTokenResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import { readItemAccessToken } from "../../../shared/db.js";
import { expectMatchesSchema, expectOk, expectStatus, expectValidationError } from "../../../shared/assertions.js";
import { createAuthedUser, seedItemWithAccount } from "../../../shared/fixtures/index.js";
import { linkTokenRequests, resetPlaidStub } from "../../../shared/plaid-stub.js";

/**
 * This file: the Plaid link-token update-mode endpoint. The stub records what
 * the backend asked Plaid for, so this covers which item's token it used and
 * whether the user may pick accounts, besides validation and ownership.
 */
test.describe("POST /api/link-tokens/update", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("answers 404 for an item owned by a different user, as for one that does not exist", async ({ request }) => {
    // Arrange: `owner` has an item; `intruder` is someone else.
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const { itemId } = await seedItemWithAccount(owner.userId);

    // Act
    const theirs = await request.post("/api/link-tokens/update", { headers: withSession(intruder.cookie), data: { itemId } });
    const missing = await request.post("/api/link-tokens/update", { headers: withSession(intruder.cookie), data: { itemId: "no-such-item" } });

    // Assert: the same answer, so the caller cannot tell which ids are in use.
    await expectStatus(theirs, 404);
    await expectStatus(missing, 404);
    expect(await theirs.json()).toMatchObject({ error: "Not found", message: "Item not found" });
    expect(await missing.json()).toMatchObject({ error: "Not found", message: "Item not found" });
  });

  test("rejects a missing itemId before contacting Plaid (validation)", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/link-tokens/update", {
      headers: withSession(cookie),
      data: {},
    });

    // Assert
    await expectValidationError(res);
  });

  test("rejects an unknown mode before contacting Plaid (validation)", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/link-tokens/update", {
      headers: withSession(cookie),
      data: { itemId: "item_1", mode: "delete-everything" },
    });

    // Assert
    await expectValidationError(res);
  });

  test("asks Plaid for an update-mode link token with the item's own access token, to repair the connection", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const { itemId } = await seedItemWithAccount(userId);

    // Act
    const res = await request.post("/api/link-tokens/update", { headers: withSession(cookie), data: { itemId } });

    // Assert
    await expectOk(res);
    const { data } = await expectMatchesSchema(res, LinkTokenResponseSchema);
    expect(data.linkToken).toMatch(/^link-stub-/);
    const [asked] = await linkTokenRequests();
    expect(asked).toMatchObject({ access_token: await readItemAccessToken(itemId), client_name: "Opulus" });
    expect(asked).not.toHaveProperty("update");
  });

  test("lets the user pick accounts when asked to add accounts", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const { itemId } = await seedItemWithAccount(userId);

    // Act
    const res = await request.post("/api/link-tokens/update", {
      headers: withSession(cookie),
      data: { itemId, mode: "add-accounts" },
    });

    // Assert: Plaid is told to turn account selection on.
    await expectOk(res);
    const [asked] = await linkTokenRequests();
    expect(asked).toMatchObject({ update: { account_selection_enabled: true } });
  });
});
