import { expect, test } from "@playwright/test";
import { UpdateItemAccountsResponseSchema } from "@opulus/core";
import { uniqueId, withSession } from "../../../shared/client.js";
import { expectErrorCode, expectMatchesSchema, expectOk, expectStatus } from "../../../shared/assertions.js";
import {
  accountExists,
  countAccountData,
  createAuthedUser,
  readItemStatus,
  readProviderAccountId,
  seedAccountOnItem,
  seedCreditLiability,
  seedHolding,
  seedInvestmentTransaction,
  seedItemWithAccount,
  seedStream,
  seedTransactions,
} from "../../../shared/fixtures/index.js";
import { failAccounts, resetPlaidStub, setPlaidItem, setPlaidLiabilities } from "../../../shared/plaid-stub.js";
import {
  creditCardAccount,
  liabilitiesFor,
  linkInstitution,
  loanAccount,
  plaidAccount,
  updateItemAccounts,
} from "../../../shared/scenarios/plaid.js";

/** The first item of the user's item list, as the client reads it. */
async function readItem(request: Parameters<typeof updateItemAccounts>[0], cookie: string, itemId: string) {
  const res = await request.get("/api/items", { headers: withSession(cookie) });
  await expectOk(res);
  return ((await res.json()).data.items as Array<{
    id: string;
    errorCode: string | null;
    newAccountsAvailable: boolean;
    accounts: Array<{ id: string; liabilityDetails: { syncedAt: string } | null }>;
  }>).find((i) => i.id === itemId)!;
}

/**
 * This file: updating an item's accounts, which the frontend calls after the
 * user finishes update mode. The Plaid stub plays Plaid's current view of the
 * item (its accounts, its liabilities, whether it needs a login).
 */
test.describe("POST /api/items/:id/update-accounts", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

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

  test("reconciles the item's accounts against Plaid's current view", async ({ request }) => {
    // Arrange: an item linked with two accounts, which Plaid still reports unchanged.
    const { cookie } = await createAuthedUser(request);
    const ids = [uniqueId("a"), uniqueId("b")];
    const { itemId } = await linkInstitution(request, cookie, { accounts: ids.map((id) => plaidAccount(id)) });

    // Act
    const res = await updateItemAccounts(request, cookie, itemId);

    // Assert: nothing new, both updated.
    await expectOk(res);
    const { data } = await expectMatchesSchema(res, UpdateItemAccountsResponseSchema);
    expect(data).toEqual({ itemId, created: 0, updated: 2, removed: 0 });
  });

  /** Everything an account can hold, seeded on it: transactions, a holding, an activity, a liability and a stream. */
  async function seedAccountData(userId: string, itemId: string, accountId: string) {
    await seedTransactions({ userId, itemId, accountId, count: 2 });
    await seedHolding({ userId, itemId, accountId });
    await seedInvestmentTransaction({ userId, itemId, accountId, type: "cash", subtype: "deposit", amount: -100 });
    await seedCreditLiability({ userId, itemId, accountId });
    await seedStream({ userId, itemId, accountId });
  }

  const ALL_SEEDED = { transactions: 2, holdings: 1, investmentTransactions: 1, liabilities: 1, streams: 1 };

  test("removes an account Plaid no longer shares, with everything stored for it, and keeps the others", async ({ request }) => {
    // Arrange: an item with two accounts, each with data; the user de-selects the second in update mode.
    const { cookie, userId } = await createAuthedUser(request);
    const kept = await seedItemWithAccount(userId);
    const dropped = await seedAccountOnItem({ userId, itemId: kept.itemId });
    await seedAccountData(userId, kept.itemId, kept.accountId);
    await seedAccountData(userId, kept.itemId, dropped.accountId);
    expect(await countAccountData(dropped.accountId)).toEqual(ALL_SEEDED);
    await setPlaidItem({ accounts: [plaidAccount(kept.providerAccountId)] });

    // Act
    const res = await updateItemAccounts(request, cookie, kept.itemId);

    // Assert: one removed, and all of its data with it; the other account and its transactions are untouched.
    await expectOk(res);
    expect((await res.json()).data).toEqual({ itemId: kept.itemId, created: 0, updated: 1, removed: 1 });
    expect(await accountExists(dropped.accountId)).toBe(false);
    expect(await countAccountData(dropped.accountId)).toEqual({ transactions: 0, holdings: 0, investmentTransactions: 0, liabilities: 0, streams: 0 });
    expect(await accountExists(kept.accountId)).toBe(true);
    expect((await countAccountData(kept.accountId)).transactions).toBe(2);
    expect((await readItem(request, cookie, kept.itemId)).accounts.map((a) => a.id)).toEqual([kept.accountId]);
  });

  test("adds and removes accounts in one update", async ({ request }) => {
    // Arrange: the user swaps one account for another in a single session.
    const { cookie, userId } = await createAuthedUser(request);
    const kept = await seedItemWithAccount(userId);
    const dropped = await seedAccountOnItem({ userId, itemId: kept.itemId });
    const addedId = uniqueId("added");
    await setPlaidItem({ accounts: [plaidAccount(kept.providerAccountId), plaidAccount(addedId)] });

    // Act
    const res = await updateItemAccounts(request, cookie, kept.itemId);

    // Assert
    await expectOk(res);
    expect((await res.json()).data).toMatchObject({ created: 1, updated: 1, removed: 1 });
    const item = await readItem(request, cookie, kept.itemId);
    expect(item.accounts).toHaveLength(2);
    expect(item.accounts.map((a) => a.id)).toContain(kept.accountId);
    expect(item.accounts.map((a) => a.id)).not.toContain(dropped.accountId);
  });

  test("keeps an account whose Plaid id changed, matching it by its persistent id, with its data", async ({ request }) => {
    // Arrange: two accounts with persistent ids; Plaid now reports the second under a new account id.
    const { cookie, userId } = await createAuthedUser(request);
    const stable = await seedItemWithAccount(userId);
    const persistent = uniqueId("persistent");
    const moved = await seedAccountOnItem({ userId, itemId: stable.itemId, persistentAccountId: persistent });
    await seedTransactions({ userId, itemId: stable.itemId, accountId: moved.accountId, count: 2 });
    const newPlaidId = uniqueId("renamed");
    await setPlaidItem({
      accounts: [plaidAccount(stable.providerAccountId), plaidAccount(newPlaidId, { persistent_account_id: persistent })],
    });

    // Act
    const res = await updateItemAccounts(request, cookie, stable.itemId);

    // Assert: the same account (and its transactions) under its new id; nothing created or removed.
    await expectOk(res);
    expect((await res.json()).data).toMatchObject({ created: 0, updated: 2, removed: 0 });
    expect(await accountExists(moved.accountId)).toBe(true);
    expect(await readProviderAccountId(moved.accountId)).toBe(newPlaidId);
    expect((await countAccountData(moved.accountId)).transactions).toBe(2);
  });

  test("removes nothing when Plaid reports no accounts", async ({ request }) => {
    // Arrange: an item with an account and data, and Plaid reporting an empty list (an error, not a user de-selecting).
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await seedTransactions({ userId, itemId: item.itemId, accountId: item.accountId, count: 2 });
    await setPlaidItem({ accounts: [] });

    // Act
    const res = await updateItemAccounts(request, cookie, item.itemId);

    // Assert
    await expectOk(res);
    expect((await res.json()).data).toMatchObject({ removed: 0 });
    expect(await accountExists(item.accountId)).toBe(true);
    expect((await countAccountData(item.accountId)).transactions).toBe(2);
  });

  test("removes nothing when none of the accounts Plaid reports is one we have", async ({ request }) => {
    // Arrange: Plaid reports only accounts we do not know, as if every id had changed.
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await seedTransactions({ userId, itemId: item.itemId, accountId: item.accountId, count: 2 });
    await setPlaidItem({ accounts: [plaidAccount(uniqueId("x")), plaidAccount(uniqueId("y"))] });

    // Act
    const res = await updateItemAccounts(request, cookie, item.itemId);

    // Assert: the new accounts are added, and ours (and their data) stay.
    await expectOk(res);
    expect((await res.json()).data).toMatchObject({ created: 2, removed: 0 });
    expect(await accountExists(item.accountId)).toBe(true);
    expect((await countAccountData(item.accountId)).transactions).toBe(2);
  });

  test("removes only the item's own accounts, never another user's", async ({ request }) => {
    // Arrange: two users, each with an item and accounts; only the first user de-selects an account.
    const first = await createAuthedUser(request);
    const second = await createAuthedUser(request);
    const mine = await seedItemWithAccount(first.userId);
    const myDropped = await seedAccountOnItem({ userId: first.userId, itemId: mine.itemId });
    const theirs = await seedItemWithAccount(second.userId);
    const theirOther = await seedAccountOnItem({ userId: second.userId, itemId: theirs.itemId });
    await seedTransactions({ userId: second.userId, itemId: theirs.itemId, accountId: theirOther.accountId, count: 2 });
    await setPlaidItem({ accounts: [plaidAccount(mine.providerAccountId)] });

    // Act
    await expectOk(await updateItemAccounts(request, first.cookie, mine.itemId));

    // Assert
    expect(await accountExists(myDropped.accountId)).toBe(false);
    expect(await accountExists(theirOther.accountId)).toBe(true);
    expect((await countAccountData(theirOther.accountId)).transactions).toBe(2);
  });

  test("refreshes the item's liabilities without duplicating them", async ({ request }) => {
    // Arrange: an item linked with a card, a mortgage and a student loan, whose liabilities were stored on link.
    const { cookie } = await createAuthedUser(request);
    const ids = { credit: uniqueId("cc"), mortgage: uniqueId("mtg"), student: uniqueId("stu") };
    await setPlaidLiabilities({ response: { liabilities: liabilitiesFor(ids) } });
    const { itemId } = await linkInstitution(request, cookie, {
      accounts: [creditCardAccount(ids.credit), loanAccount(ids.mortgage, "mortgage"), loanAccount(ids.student, "student")],
    });
    const liabilities = async () =>
      (await readItem(request, cookie, itemId)).accounts.flatMap((a) => (a.liabilityDetails ? [{ id: a.id, syncedAt: a.liabilityDetails.syncedAt }] : []));
    const before = await liabilities();
    expect(before).toHaveLength(3);

    // Act
    await expectOk(await updateItemAccounts(request, cookie, itemId));

    // Assert: still one liability per account, each fetched again (its syncedAt moved forward).
    const after = await liabilities();
    expect(after.map((l) => l.id).sort()).toEqual(before.map((l) => l.id).sort());
    for (const liability of after) {
      const previous = before.find((l) => l.id === liability.id)!;
      expect(Date.parse(liability.syncedAt)).toBeGreaterThan(Date.parse(previous.syncedAt));
    }
  });

  test("keeps the new-accounts prompt until new accounts are added, then clears it", async ({ request }) => {
    // Arrange: an item flagged as having new accounts to share (as the webhook flags it), with one account we know.
    const { cookie, userId } = await createAuthedUser(request);
    const known = await seedItemWithAccount(userId, { newAccountsAvailable: true });
    await setPlaidItem({ accounts: [plaidAccount(known.providerAccountId)] });

    // Act 1: the user finishes update mode but shares nothing new.
    const first = await updateItemAccounts(request, cookie, known.itemId);

    // Assert 1: nothing was added, so the prompt stays.
    await expectOk(first);
    expect((await first.json()).data.created).toBe(0);
    expect((await readItem(request, cookie, known.itemId)).newAccountsAvailable).toBe(true);

    // Act 2: Plaid now returns an account we do not have.
    await setPlaidItem({ accounts: [plaidAccount(known.providerAccountId), plaidAccount(uniqueId("new"))] });
    const second = await updateItemAccounts(request, cookie, known.itemId);

    // Assert 2: it is added, and the prompt goes away.
    await expectOk(second);
    expect((await second.json()).data.created).toBe(1);
    expect((await readItem(request, cookie, known.itemId)).newAccountsAvailable).toBe(false);
  });

  test("stores when the item's consent expires, as Plaid now reports it", async ({ request }) => {
    // Arrange: an item linked with no expiry; Plaid then says its consent ends in December.
    const { cookie } = await createAuthedUser(request);
    const account = plaidAccount(uniqueId("a"));
    const { itemId } = await linkInstitution(request, cookie, { accounts: [account] });
    expect((await readItemStatus(itemId)).consentExpirationTime).toBeNull();
    await setPlaidItem({ accounts: [account], consent_expiration_time: "2026-12-15T00:00:00Z" });

    // Act
    await expectOk(await updateItemAccounts(request, cookie, itemId));

    // Assert
    expect((await readItemStatus(itemId)).consentExpirationTime?.toISOString()).toBe("2026-12-15T00:00:00.000Z");
  });

  test("clears a connection warning once the user has re-authenticated", async ({ request }) => {
    // Arrange: an item with a pending-disconnect warning recorded (as the webhook records it), which Plaid no longer reports.
    const { cookie, userId } = await createAuthedUser(request);
    const known = await seedItemWithAccount(userId, { errorType: "ITEM_ERROR", errorCode: "PENDING_DISCONNECT", errorMessage: "Plaid will disconnect this item" });
    await setPlaidItem({ accounts: [plaidAccount(known.providerAccountId)] });
    expect((await readItem(request, cookie, known.itemId)).errorCode).toBe("PENDING_DISCONNECT");

    // Act: what the frontend calls after the user completes update mode.
    await expectOk(await updateItemAccounts(request, cookie, known.itemId));

    // Assert
    expect((await readItem(request, cookie, known.itemId)).errorCode).toBeNull();
  });

  test("reports an item whose bank login has changed as 409 ITEM_LOGIN_REQUIRED", async ({ request }) => {
    // Arrange: Plaid says the item needs the user to log in again.
    const { cookie, userId } = await createAuthedUser(request);
    const { itemId } = await seedItemWithAccount(userId);
    await failAccounts("ITEM_LOGIN_REQUIRED");

    // Act
    const res = await updateItemAccounts(request, cookie, itemId);

    // Assert: Plaid's error code reaches the client, so the UI can tell the user to reconnect, instead of an opaque 500.
    await expectStatus(res, 409);
    await expectErrorCode(res, "ITEM_LOGIN_REQUIRED");
  });
});
