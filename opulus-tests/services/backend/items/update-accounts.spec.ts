import { expect, test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import { expectStatus } from "../../../shared/assertions.js";
import { createAuthedUser, seedItemWithAccount } from "../../../shared/fixtures/index.js";

/**
 * This file: the service-owned boundary of updating an item's accounts. The
 * happy path calls Plaid (see the integration suite); whose item it is is
 * decided before any Plaid call.
 */
test.describe("POST /api/items/:id/update-accounts", () => {
  test("answers 404 for an item owned by a different user, as for one that does not exist", async ({ request }) => {
    // Arrange: `owner` has an item; `intruder` is someone else.
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const { itemId } = await seedItemWithAccount(owner.userId);

    // Act
    const theirs = await request.post(`/api/items/${itemId}/update-accounts`, { headers: withSession(intruder.cookie) });
    const missing = await request.post("/api/items/no-such-item/update-accounts", { headers: withSession(intruder.cookie) });

    // Assert: the same answer, so the caller cannot tell which ids are in use.
    await expectStatus(theirs, 404);
    await expectStatus(missing, 404);
    expect(await theirs.json()).toMatchObject({ error: "Not found", message: "Item not found" });
    expect(await missing.json()).toMatchObject({ error: "Not found", message: "Item not found" });
  });
});
