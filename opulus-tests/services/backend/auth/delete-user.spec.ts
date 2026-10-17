import { expect, test } from "@playwright/test";
import {
  expectErrorCode,
  expectStatus,
} from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { readItemAccessToken } from "../../../shared/db.js";
import { countItems, seedItemWithAccount, signIn, signUp } from "../../../shared/fixtures/index.js";
import { failItemRemoval, removedAccessTokens, resetPlaidStub } from "../../../shared/plaid-stub.js";

/**
 * This file: POST /api/auth/delete-user. With bank connections, deleting an
 * account first revokes each item at Plaid (the Plaid stub) and refuses to
 * delete anything if Plaid will not.
 */
test.describe("POST /api/auth/delete-user", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/auth/delete-user", {
      data: { password: "whatever" },
    });

    await expectStatus(res, 401);
  });

  test("requires the password (400, PASSWORD_REQUIRED)", async ({ request }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: {},
    });

    // Assert: refused, and the account still works.
    await expectStatus(res, 400);
    await expectErrorCode(res, "PASSWORD_REQUIRED");
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      200,
    );
  });

  test("rejects a wrong password (400, INVALID_PASSWORD)", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: "not-the-password" },
    });

    // Assert
    await expectStatus(res, 400);
    await expectErrorCode(res, "INVALID_PASSWORD");
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      200,
    );
  });

  test("deletes the account: the session ends and signing in fails", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Assert
    await expectStatus(res, 200);
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      401,
    );
    await expect(signIn(request, user.email, user.password)).rejects.toThrow();
  });

  test("leaves other users alone", async ({ request }) => {
    // Arrange
    const leaving = await signUp(request);
    const staying = await signUp(request);

    // Act
    await request.post("/api/auth/delete-user", {
      headers: withSession(leaving.cookie),
      data: { password: leaving.password },
    });

    // Assert
    await expectStatus(
      await request.get("/api/session", { headers: withSession(staying.cookie) }),
      200,
    );
  });

  test("revokes the user's items at Plaid and deletes their data", async ({ request }) => {
    // Arrange: a user with two linked items.
    const user = await signUp(request);
    const items = [await seedItemWithAccount(user.user.id), await seedItemWithAccount(user.user.id)];
    const tokens = await Promise.all(items.map((i) => readItemAccessToken(i.itemId)));

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Assert: both tokens were revoked, and the user and their items are gone.
    await expectStatus(res, 200);
    expect((await removedAccessTokens()).sort()).toEqual([...tokens].sort());
    await expectStatus(await request.get("/api/session", { headers: withSession(user.cookie) }), 401);
    expect(await countItems(items.map((i) => i.itemId))).toBe(0);
  });

  test("does not revoke another user's items", async ({ request }) => {
    // Arrange: two users, each with an item.
    const leaving = await signUp(request);
    const staying = await signUp(request);
    const leavingItem = await seedItemWithAccount(leaving.user.id);
    const stayingItem = await seedItemWithAccount(staying.user.id);
    const leavingToken = await readItemAccessToken(leavingItem.itemId);

    // Act
    await request.post("/api/auth/delete-user", {
      headers: withSession(leaving.cookie),
      data: { password: leaving.password },
    });

    // Assert: only the leaving user's token was revoked, and the other item is still there.
    expect(await removedAccessTokens()).toEqual([leavingToken]);
    expect(await countItems([stayingItem.itemId])).toBe(1);
  });

  test("refuses to delete the account when Plaid will not revoke an item (502)", async ({ request }) => {
    // Arrange: an item Plaid will not remove, for a reason other than "not found".
    const user = await signUp(request);
    const item = await seedItemWithAccount(user.user.id);
    await failItemRemoval("INTERNAL_SERVER_ERROR");

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Assert: refused with the reason, and nothing was deleted: the account still works and the item is kept.
    await expectStatus(res, 502);
    await expectErrorCode(res, "PLAID_DISCONNECT_FAILED");
    await expectStatus(await request.get("/api/session", { headers: withSession(user.cookie) }), 200);
    await signIn(request, user.email, user.password);
    expect(await countItems([item.itemId])).toBe(1);
  });
});
