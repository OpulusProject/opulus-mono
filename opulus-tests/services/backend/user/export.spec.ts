import { expect, test } from "@playwright/test";
import { UserDataExportSchema } from "@opulus/core";
import { expectStatus } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import {
  createAuthedUser,
  seedItemWithAccount,
  seedTransactions,
} from "../../../shared/fixtures/index.js";

/**
 * This file: the data export (GET /api/user/export), a download of everything
 * the user owns as one JSON document written in pieces.
 */
test.describe("GET /api/user/export", () => {
  test("requires authentication (401)", async ({ request }) => {
    await expectStatus(await request.get("/api/user/export"), 401);
  });

  test("gives a user with nothing connected an empty but valid export", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId, email } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/user/export", {
      headers: withSession(cookie),
    });

    // Assert
    await expectStatus(res, 200);
    const data = UserDataExportSchema.parse(await res.json());
    expect(data.user).toMatchObject({ id: userId, email });
    expect(data.connections).toEqual([]);
    expect(data.transactions).toEqual([]);
  });

  test("is a JSON download", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.get("/api/user/export", {
      headers: withSession(cookie),
    });

    expect(res.headers()["content-type"]).toContain("application/json");
    expect(res.headers()["content-disposition"]).toMatch(
      /^attachment; filename="opulus-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers()["cache-control"]).toBe("no-store");
  });

  test("includes the connections, accounts and every transaction, oldest first", async ({
    request,
  }) => {
    // Arrange: one connection with an account, a pending transaction among
    // the transactions.
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId, {
      institutionName: "Export Bank",
      account: { balanceCurrent: 500 },
    });
    await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      rows: [
        { name: "March", date: new Date("2026-03-01T00:00:00Z") },
        { name: "January", date: new Date("2026-01-01T00:00:00Z") },
        { name: "February", date: new Date("2026-02-01T00:00:00Z"), pending: true },
      ],
    });

    // Act
    const res = await request.get("/api/user/export", {
      headers: withSession(cookie),
    });

    // Assert
    const data = UserDataExportSchema.parse(await res.json());
    expect(data.connections).toHaveLength(1);
    expect(data.connections[0]).toMatchObject({ institutionName: "Export Bank" });
    expect(data.connections[0]!.accounts).toHaveLength(1);
    expect(data.transactions.map((t) => t.name)).toEqual([
      "January",
      "February",
      "March",
    ]);
    expect(data.transactions.find((t) => t.name === "February")?.pending).toBe(true);
  });

  test("writes every page of a long history, with no gap or repeat", async ({
    request,
  }) => {
    // Arrange: more than two pages of transactions (a page is 1000).
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    const { names } = await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      count: 2105,
    });

    // Act
    const res = await request.get("/api/user/export", {
      headers: withSession(cookie),
    });

    // Assert
    const data = UserDataExportSchema.parse(await res.json());
    expect(data.transactions).toHaveLength(2105);
    expect(new Set(data.transactions.map((t) => t.id)).size).toBe(2105);
    expect(data.transactions.map((t) => t.name).sort()).toEqual([...names].sort());
    const dates = data.transactions.map((t) => t.date);
    expect(dates).toEqual([...dates].sort());
  });

  test("contains only the requesting user's data", async ({ request }) => {
    // Arrange: another user with a connection and transactions.
    const other = await createAuthedUser(request);
    const otherItem = await seedItemWithAccount(other.userId);
    await seedTransactions({
      userId: other.userId,
      itemId: otherItem.itemId,
      accountId: otherItem.accountId,
      rows: [{ name: "Someone else's coffee" }],
    });
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/user/export", {
      headers: withSession(cookie),
    });

    // Assert
    const text = await res.text();
    expect(text).not.toContain("Someone else's coffee");
    expect(text).not.toContain(other.email);
    expect(UserDataExportSchema.parse(JSON.parse(text)).connections).toEqual([]);
  });

  test("leaves out everything secret", async ({ request }) => {
    // Arrange: a connection, whose Plaid access token must not leave the database.
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    const { testDb } = await import("../../../shared/db.js");
    const { accessToken, plaidItemId } = await testDb().item.findUniqueOrThrow({
      where: { id: item.itemId },
      select: { accessToken: true, plaidItemId: true },
    });

    // Act
    const text = await (
      await request.get("/api/user/export", { headers: withSession(cookie) })
    ).text();

    // Assert: no access token, Plaid item id, password hash, secret or session token.
    for (const secret of [accessToken, plaidItemId, "accessToken", "password", "secret", "backupCodes", "token"]) {
      expect(text).not.toContain(secret);
    }
  });

  test("answers 429 after the third export in an hour", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const get = () =>
      request.get("/api/user/export", { headers: withSession(cookie) });

    // Act
    for (let i = 0; i < 3; i++) await expectStatus(await get(), 200);
    const limited = await get();

    // Assert
    await expectStatus(limited, 429);
    expect((await limited.json()).code).toBe("RATE_LIMITED");
  });
});
