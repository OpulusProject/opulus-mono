import { expect, test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import { expectStatus, expectValidationError } from "../../../shared/assertions.js";
import { createAuthedUser, seedItemWithAccount } from "../../../shared/fixtures/index.js";

/**
 * This file: the Plaid link-token update-mode endpoint. Its happy path proxies
 * Plaid, so this suite covers the service-owned boundary that runs before any
 * Plaid call: authentication gating and request-body validation.
 */
test.describe("POST /api/link-tokens/update", () => {
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
});
