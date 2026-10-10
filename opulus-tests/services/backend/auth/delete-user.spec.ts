import { expect, test, type APIRequestContext } from "@playwright/test";
import { BASE_URL, withSession } from "../../../shared/client.js";
import {
  expectErrorCode,
  expectOk,
  expectStatus,
} from "../../../shared/assertions.js";
import {
  TEST_PASSWORD,
  createUserWithTwoFactor,
  seedItemWithAccount,
  seedTransactions,
  signIn,
  signUp,
} from "../../../shared/fixtures/index.js";

/**
 * This file: the better-auth delete-user endpoint, which is how a user deletes
 * their account and all their data. Before the rows go, the backend asks Plaid
 * to remove the user's items (beforeDelete in auth.ts). The service suite cannot
 * reach Plaid: the items seeded here carry fake access tokens, so every Plaid
 * removal fails, and the happy path therefore also proves that a Plaid failure
 * never blocks the deletion. That Plaid really stops serving a real item is
 * covered by the sandbox suite (integration/backend/auth/delete-user.spec.ts).
 */

async function listItemIds(
  request: APIRequestContext,
  cookie: string,
): Promise<string[]> {
  const res = await request.get("/api/items", { headers: withSession(cookie) });
  await expectOk(res);
  return ((await res.json()).data.items as Array<{ id: string }>).map(
    (i) => i.id,
  );
}

test.describe("POST /api/auth/delete-user", () => {
  test("requires authentication (401)", async ({ playwright }) => {
    // Arrange: a cookie-less context, so no session is replayed.
    const anonymous = await playwright.request.newContext({
      baseURL: BASE_URL,
    });

    // Act
    const res = await anonymous.post("/api/auth/delete-user", {
      data: { password: TEST_PASSWORD },
    });
    await anonymous.dispose();

    // Assert
    await expectStatus(res, 401);
  });

  test("requires the password even for a fresh session (400, PASSWORD_REQUIRED) and deletes nothing", async ({
    request,
  }) => {
    // Arrange: a user who has just signed up, so their session is fresh.
    const user = await signUp(request);
    const seeded = await seedItemWithAccount(user.user.id);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: {},
    });

    // Assert: refused, and the user and their item are still there.
    await expectStatus(res, 400);
    await expectErrorCode(res, "PASSWORD_REQUIRED");
    expect(await listItemIds(request, user.cookie)).toContain(seeded.itemId);
  });

  test("rejects a wrong password (400, INVALID_PASSWORD) and deletes nothing", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);
    const seeded = await seedItemWithAccount(user.user.id);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: "wrong-password" },
    });

    // Assert: the account still works and keeps its data.
    await expectStatus(res, 400);
    await expectErrorCode(res, "INVALID_PASSWORD");
    await signIn(request, user.email, user.password);
    expect(await listItemIds(request, user.cookie)).toContain(seeded.itemId);
  });

  test("deletes the user, ends their sessions and removes their data even though Plaid cannot remove the items", async ({
    request,
  }) => {
    // Arrange: a user with two items (each with an account and transactions).
    // The items have fake access tokens, so Plaid will reject their removal.
    const user = await signUp(request);
    const first = await seedItemWithAccount(user.user.id);
    const second = await seedItemWithAccount(user.user.id);
    for (const seeded of [first, second]) {
      await seedTransactions({
        userId: user.user.id,
        itemId: seeded.itemId,
        accountId: seeded.accountId,
        count: 2,
      });
    }
    const otherSession = await signIn(request, user.email, user.password);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Assert: deleted ...
    await expectOk(res);
    expect((await res.json()).success).toBe(true);

    // ... every session of theirs is dead ...
    for (const cookie of [user.cookie, otherSession.cookie]) {
      await expectStatus(
        await request.get("/api/session", { headers: withSession(cookie) }),
        401,
      );
    }

    // ... they can no longer sign in ...
    const signInRes = await request.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: user.password },
    });
    await expectStatus(signInRes, 401);
    await expectErrorCode(signInRes, "INVALID_EMAIL_OR_PASSWORD");

    // ... and their data is gone. The email can be registered again (so the
    // user row is gone), the new user starts empty, and the old item ids are
    // unknown (404) rather than somebody else's (401).
    const reborn = await signUp(request, { email: user.email });
    expect(reborn.user.id).not.toBe(user.user.id);
    expect(await listItemIds(request, reborn.cookie)).toEqual([]);
    for (const seeded of [first, second]) {
      await expectStatus(
        await request.delete(`/api/items/${seeded.itemId}`, {
          headers: withSession(reborn.cookie),
        }),
        404,
      );
    }
  });

  test("leaves another user's account and data untouched", async ({
    request,
  }) => {
    // Arrange: two users, each with an item, an account and transactions.
    const leaving = await signUp(request);
    const staying = await signUp(request);
    const leavingItem = await seedItemWithAccount(leaving.user.id);
    const stayingItem = await seedItemWithAccount(staying.user.id);
    const { names } = await seedTransactions({
      userId: staying.user.id,
      itemId: stayingItem.itemId,
      accountId: stayingItem.accountId,
      count: 2,
    });

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(leaving.cookie),
      data: { password: leaving.password },
    });

    // Assert: the other user can still sign in and keeps everything.
    await expectOk(res);
    const after = await signIn(request, staying.email, staying.password);
    const items = await listItemIds(request, after.cookie);
    expect(items).toContain(stayingItem.itemId);
    expect(items).not.toContain(leavingItem.itemId);

    const txns = await request.get(
      `/api/transactions?itemId=${stayingItem.itemId}`,
      { headers: withSession(after.cookie) },
    );
    await expectOk(txns);
    expect(
      ((await txns.json()).data.transactions as Array<{ name: string }>).map(
        (t) => t.name,
      ),
    ).toEqual(expect.arrayContaining(names));
  });

  test("deletes a user who has two-factor authentication enabled", async ({
    request,
  }) => {
    // Arrange
    const user = await createUserWithTwoFactor(request);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Assert: gone, and a new account on the same email has no 2FA left over.
    await expectOk(res);
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      401,
    );
    const reborn = await signUp(request, { email: user.email });
    const signInRes = await request.post("/api/auth/sign-in/email", {
      data: { email: reborn.email, password: reborn.password },
    });
    await expectOk(signInRes);
    expect((await signInRes.json()).twoFactorRedirect).toBeFalsy();
  });
});
