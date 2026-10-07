import { expect, test } from "@playwright/test";
import { UpdateItemAccountsResponseSchema } from "@opulus/core";

import { expectOk, expectStatus, expectMatchesSchema } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { testDb } from "../../../shared/db.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  scrambleProviderAccountIds,
  seedAccountForItem,
  seedTransactions,
} from "../../../shared/fixtures/index.js";
import {
  createSandboxItem,
  requireSandboxCredentials,
} from "../helpers/plaidSandbox.js";

/**
 * POST /api/items/:id/update-accounts — Plaid Sandbox round-trip.
 *
 * No service-suite coverage exists for this route beyond what will be added
 * for 401. Here we create a real sandbox item and immediately re-sync its
 * accounts; since Plaid's view hasn't changed, we expect every account to be
 * reported as `updated` (or `unchanged`) and none as `created`.
 *
 * Sandbox items are fixed on the Plaid side, so a divergence from Plaid's view
 * (an account Plaid no longer returns, ids that no longer match) has to be
 * seeded from our side through the test DB fixtures.
 */
test.describe("POST /api/items/:id/update-accounts (sandbox)", () => {
  test("reconciles a persisted item's accounts against Plaid's current view", async ({
    request,
  }) => {
    // Arrange: authenticated user + one real sandbox item they own.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);

    // Act
    const res = await request.post(`/api/items/${itemId}/update-accounts`, {
      headers: withSession(cookie),
    });

    // Assert: no new accounts should have appeared since the initial link;
    // every Plaid-reported account should map to the rows we just wrote.
    await expectOk(res);
    await expectMatchesSchema(res, UpdateItemAccountsResponseSchema);
    const body = (await res.json()) as {
      data: {
        itemId: string;
        created: number;
        updated: number;
        removed: number;
      };
    };
    expect(body.data.itemId).toBe(itemId);
    expect(body.data.created).toBe(0);
    expect(body.data.updated).toBeGreaterThan(0);
    expect(body.data.removed).toBe(0);
  });

  test("refreshes the item's liabilities without duplicating them", async ({
    request,
  }) => {
    // Arrange: a freshly linked sandbox item, whose liabilities were stored on link.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);
    const readLiabilities = async () => {
      const res = await request.get("/api/items", {
        headers: withSession(cookie),
      });
      await expectOk(res);
      const item = (
        (await res.json()).data.items as Array<{
          id: string;
          accounts: Array<{
            id: string;
            liabilityDetails: { syncedAt: string } | null;
          }>;
        }>
      ).find((i) => i.id === itemId);
      return (item?.accounts ?? []).flatMap((account) =>
        account.liabilityDetails
          ? [{ id: account.id, syncedAt: account.liabilityDetails.syncedAt }]
          : [],
      );
    };
    const before = await readLiabilities();
    expect(before.length).toBeGreaterThan(0);

    // Act
    const res = await request.post(`/api/items/${itemId}/update-accounts`, {
      headers: withSession(cookie),
    });

    // Assert: the same accounts still have exactly one liability each, and each
    // was re-fetched (its syncedAt moved forward).
    await expectOk(res);
    const after = await readLiabilities();
    expect(after.map((l) => l.id).sort()).toEqual(
      before.map((l) => l.id).sort(),
    );
    for (const liability of after) {
      const previous = before.find((l) => l.id === liability.id);
      expect(Date.parse(liability.syncedAt)).toBeGreaterThan(
        Date.parse(previous!.syncedAt),
      );
    }
  });

  test("keeps the new-accounts prompt until new accounts are added, then clears it", async ({
    request,
  }) => {
    // Arrange: an item flagged as having new accounts to share. A
    // NEW_ACCOUNTS_AVAILABLE webhook sets this flag in practice, but Plaid's
    // sandbox only fires that webhook for items created through Link with
    // Account Select v2 (see the webhook end-to-end suite, whose test of it
    // skips for that reason). So the flag is set directly here, to test what
    // update-accounts does with it. Replace this with a fired webhook once
    // the sandbox can send one for our items.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);
    const db = testDb();
    await db.item.update({
      where: { id: itemId },
      data: { newAccountsAvailable: true },
    });
    const flag = async () =>
      (await db.item.findUniqueOrThrow({ where: { id: itemId } }))
        .newAccountsAvailable;
    const updateAccounts = () =>
      request.post(`/api/items/${itemId}/update-accounts`, {
        headers: withSession(cookie),
      });

    // Act 1: the user finishes update mode but shares nothing new.
    const first = await updateAccounts();

    // Assert 1: nothing was added, so the prompt stays.
    await expectOk(first);
    expect((await first.json()).data.created).toBe(0);
    expect(await flag()).toBe(true);

    // Act 2: Plaid now returns an account we don't have. The sandbox can't
    // add an account to an existing item, so that is simulated by removing
    // our row for one.
    const account = await db.account.findFirstOrThrow({ where: { itemId } });
    await db.account.delete({ where: { id: account.id } });
    const second = await updateAccounts();

    // Assert 2: it is added and the prompt goes away.
    await expectOk(second);
    expect((await second.json()).data.created).toBe(1);
    expect(await flag()).toBe(false);
  });

  test("removes an account Plaid no longer returns, with its transactions", async ({
    request,
  }) => {
    // Arrange: a real sandbox item, plus an extra account (with transactions)
    // that Plaid doesn't return, as if the user had de-selected it.
    const creds = requireSandboxCredentials();
    const { cookie, userId } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);
    const gone = await seedAccountForItem({ itemId, userId });
    const { names } = await seedTransactions({
      userId,
      itemId,
      accountId: gone.accountId,
      count: 2,
    });
    const listAccounts = async () =>
      (
        (await (
          await request.get("/api/accounts", { headers: withSession(cookie) })
        ).json()) as { data: { accounts: Array<{ id: string; name: string }> } }
      ).data.accounts;
    const before = await listAccounts();
    expect(before.map((a) => a.id)).toContain(gone.accountId);

    // Act
    const res = await request.post(`/api/items/${itemId}/update-accounts`, {
      headers: withSession(cookie),
    });

    // Assert: only the account Plaid no longer returns is gone, and its
    // transactions went with it.
    await expectOk(res);
    expect((await res.json()).data.removed).toBe(1);
    const after = await listAccounts();
    expect(after.map((a) => a.id)).not.toContain(gone.accountId);
    expect(after).toHaveLength(before.length - 1);
    const transactions = (await (
      await request.get("/api/transactions?limit=100", {
        headers: withSession(cookie),
      })
    ).json()) as { data: { transactions: Array<{ name: string }> } };
    for (const name of names) {
      expect(transactions.data.transactions.map((t) => t.name)).not.toContain(
        name,
      );
    }
  });

  test("removes nothing when none of Plaid's accounts match ours", async ({
    request,
  }) => {
    // Arrange: a sandbox item whose accounts all carry ids Plaid doesn't know,
    // which is what it looks like if Plaid changes every account id. That is
    // not the user de-selecting, so none of them may be deleted.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);
    const originalIds = await scrambleProviderAccountIds(itemId);
    expect(originalIds.length).toBeGreaterThan(0);

    // Act
    const res = await request.post(`/api/items/${itemId}/update-accounts`, {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    expect((await res.json()).data.removed).toBe(0);
    const accounts = (await (
      await request.get("/api/accounts", { headers: withSession(cookie) })
    ).json()) as { data: { accounts: Array<{ id: string }> } };
    expect(accounts.data.accounts.map((a) => a.id)).toEqual(
      expect.arrayContaining(originalIds),
    );
  });

  test("rejects an item owned by a different user (401)", async ({
    request,
  }) => {
    // Arrange: one real sandbox item owned by `owner`; `intruder` tries to use it.
    const creds = requireSandboxCredentials();
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, owner.cookie, creds);

    // Act
    const res = await request.post(`/api/items/${itemId}/update-accounts`, {
      headers: withSession(intruder.cookie),
    });

    // Assert
    await expectStatus(res, 401);
  });
});
