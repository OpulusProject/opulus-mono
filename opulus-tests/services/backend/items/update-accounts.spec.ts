import { expect, test } from "@playwright/test";
import { UpdateItemAccountsResponseSchema } from "@opulus/core";
import { uniqueId, withSession } from "../../../shared/client.js";
import { expectErrorCode, expectMatchesSchema, expectOk, expectStatus } from "../../../shared/assertions.js";
import { createAuthedUser, readItemStatus, seedItemWithAccount } from "../../../shared/fixtures/index.js";
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
    expect(data).toEqual({ itemId, created: 0, updated: 2 });
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
