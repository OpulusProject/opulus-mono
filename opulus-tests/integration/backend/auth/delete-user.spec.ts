import { expect, test } from "@playwright/test";
import { expectOk, expectStatus } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { testDb } from "../../../shared/db.js";
import {
  enrollTwoFactor,
  seedItemWithAccount,
  signIn,
  signUp,
} from "../../../shared/fixtures/index.js";
import {
  createSandboxItem,
  plaidStillServesItem,
  requireSandboxCredentials,
} from "../../helpers/plaidSandbox.js";

/**
 * POST /api/auth/delete-user, with bank connections: Plaid Sandbox round-trip.
 *
 * Deleting an account removes the user's items from Plaid first, which the
 * service suite cannot see (its items have fake access tokens). Here the items
 * are real sandbox items created through the backend's own POST /api/items. The
 * Plaid access token is read from the isolated test DB (a setup lookup; it is
 * never exposed over HTTP) so that, after the delete, Plaid itself can be asked
 * whether it still serves the item.
 */
test.describe("POST /api/auth/delete-user (sandbox)", () => {
  test("removes the user's items from Plaid and deletes their data", async ({
    request,
  }) => {
    // Arrange: a user with two real sandbox items (one per institution).
    const creds = requireSandboxCredentials();
    const user = await enrollTwoFactor(request, await signUp(request));
    const itemIds = [
      (await createSandboxItem(request, user.cookie, creds)).itemId,
      (
        await createSandboxItem(request, user.cookie, creds, "ins_109509")
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

    // Assert: Plaid no longer serves either item, and the user and their data are gone.
    await expectOk(res);
    for (const { accessToken } of items) {
      expect(await plaidStillServesItem(creds, accessToken)).toBe(false);
    }
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      401,
    );
    expect(
      await testDb().item.count({ where: { id: { in: itemIds } } }),
    ).toBe(0);
  });

  test("does not touch another user's Plaid items", async ({ request }) => {
    // Arrange: two users, each with a real sandbox item.
    const creds = requireSandboxCredentials();
    const leaving = await enrollTwoFactor(request, await signUp(request));
    const staying = await enrollTwoFactor(request, await signUp(request));
    await createSandboxItem(request, leaving.cookie, creds);
    const { itemId } = await createSandboxItem(request, staying.cookie, creds);
    const { accessToken } = await testDb().item.findUniqueOrThrow({
      where: { id: itemId },
      select: { accessToken: true },
    });

    // Act
    await request.post("/api/auth/delete-user", {
      headers: withSession(leaving.cookie),
      data: { password: leaving.password },
    });

    // Assert
    expect(await plaidStillServesItem(creds, accessToken)).toBe(true);
  });

  test("refuses to delete the account when Plaid will not remove an item (502)", async ({
    request,
  }) => {
    // Arrange: an item with an access token Plaid does not accept (seeded, not
    // from Plaid), so removing it fails with something other than "not found".
    requireSandboxCredentials();
    const user = await enrollTwoFactor(request, await signUp(request));
    await seedItemWithAccount(user.user.id);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Assert: refused with the reason, and the account still works.
    await expectStatus(res, 502);
    expect((await res.json()).code).toBe("PLAID_DISCONNECT_FAILED");
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      200,
    );
    await signIn(request, user.email, user.password);
  });
});
