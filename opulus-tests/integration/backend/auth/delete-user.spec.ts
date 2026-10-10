import { expect, test } from "@playwright/test";

import { expectOk, expectStatus } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { testDb } from "../../../shared/db.js";
import { signUp } from "../../../shared/fixtures/index.js";
import {
  createSandboxItem,
  plaidStillServesItem,
  requireSandboxCredentials,
} from "../../helpers/plaidSandbox.js";

/**
 * POST /api/auth/delete-user: Plaid Sandbox round-trip.
 *
 * Deleting an account removes the user's items from Plaid first (beforeDelete
 * in auth.ts), which the service suite cannot see: its items have fake access
 * tokens. Here the items are real sandbox items created through the backend's
 * own POST /api/items. The Plaid access token is read from the isolated test DB
 * (setup lookup only; it is never exposed over HTTP) so that, after the delete,
 * Plaid itself can be asked whether it still serves the item.
 */
test.describe("POST /api/auth/delete-user (sandbox)", () => {
  test("removes the user's items from Plaid and deletes their data", async ({
    request,
  }) => {
    // Arrange: a user with two real sandbox items. A user can have only one item
    // per institution, so the second one is at a different sandbox institution.
    const creds = requireSandboxCredentials();
    const user = await signUp(request);
    const itemIds = [
      (await createSandboxItem(request, user.cookie, creds)).itemId,
      (
        await createSandboxItem(
          request,
          user.cookie,
          creds,
          "ins_109509", // "First Gingham Credit Union"
        )
      ).itemId,
    ];
    const items = await testDb().item.findMany({
      where: { id: { in: itemIds } },
      select: { accessToken: true },
    });
    expect(items).toHaveLength(2);
    for (const { accessToken } of items) {
      expect(await plaidStillServesItem(creds, accessToken)).toBe(true);
    }

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Assert: Plaid no longer serves either item, and the user is gone.
    await expectOk(res);
    for (const { accessToken } of items) {
      expect(await plaidStillServesItem(creds, accessToken)).toBe(false);
    }
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      401,
    );
  });

  test("does not touch another user's Plaid items", async ({ request }) => {
    // Arrange: two users, each with a real sandbox item.
    const creds = requireSandboxCredentials();
    const leaving = await signUp(request);
    const staying = await signUp(request);
    await createSandboxItem(request, leaving.cookie, creds);
    const { itemId } = await createSandboxItem(request, staying.cookie, creds);
    const { accessToken } = await testDb().item.findUniqueOrThrow({
      where: { id: itemId },
      select: { accessToken: true },
    });

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(leaving.cookie),
      data: { password: leaving.password },
    });

    // Assert: the other user's item is still connected on Plaid's side.
    await expectOk(res);
    expect(await plaidStillServesItem(creds, accessToken)).toBe(true);
  });
});
