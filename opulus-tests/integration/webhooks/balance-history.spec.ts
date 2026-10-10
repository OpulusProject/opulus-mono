import { expect, test } from "@playwright/test";

import { withSession } from "../../shared/client.js";
import { createAuthedUser } from "../../shared/fixtures/auth.js";
import {
  readHistoricBalances,
  type StoredHistoricBalance,
} from "../../shared/fixtures/historic-balances.js";
import { requireSandboxCredentials } from "../helpers/plaidSandbox.js";
import {
  fireSandboxWebhook,
  linkItemWithWebhook,
  readItem,
  waitFor,
} from "./helpers.js";

interface ListedAccount {
  id: string;
  type: string;
  balanceCurrent: number | null;
  isoCurrencyCode: string | null;
  connection: { id: string };
}
interface ListedTransaction {
  accountId: string;
  /** ISO timestamp of the day it happened. */
  date: string;
  amount: number;
  pending: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const day = (offset: number) =>
  new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);

/**
 * What an account's balance was at the close of each day from `first` to
 * yesterday, worked out here from the account's balance now and its
 * transactions, independently of the code under test: cash adds back what was
 * spent since, credit and loan balances (what is owed) take it off, anything
 * else (investments) is flat. Amounts are Plaid's: positive is money out.
 */
function expectedBalances(
  account: ListedAccount,
  transactions: ListedTransaction[],
  first: string,
  yesterday: string,
): Map<string, number> {
  const sign =
    account.type === "depository"
      ? 1
      : account.type === "credit" || account.type === "loan"
        ? -1
        : 0;
  const expected = new Map<string, number>();
  for (
    let date = first;
    date <= yesterday;
    date = new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS)
      .toISOString()
      .slice(0, 10)
  ) {
    const after = transactions
      .filter((t) => t.accountId === account.id && t.date.slice(0, 10) > date)
      .reduce((sum, t) => sum + t.amount, 0);
    expected.set(
      date,
      Math.round((account.balanceCurrent! + sign * after) * 10_000) / 10_000,
    );
  }
  return expected;
}

/**
 * The balance history the receiver writes after it syncs a new item. Plaid's
 * sandbox pull completes at once, so the first sync reports the full history
 * loaded (transactions_update_status HISTORICAL_UPDATE_COMPLETE), which is what
 * lets the backfill run.
 *
 * Nothing exposes the history rows over HTTP in this PR, so this spec reads
 * them from the table (see shared/fixtures/historic-balances.ts); everything
 * else it needs it reads over HTTP.
 */
test.describe("balance history (sandbox to receiver)", () => {
  test("linking a new item writes each account's closing balances to the table, once", async ({
    request,
  }) => {
    // Arrange: a new item, with no history until its transactions are synced.
    const creds = requireSandboxCredentials();
    const user = await createAuthedUser(request);
    const { itemId, accessToken } = await linkItemWithWebhook(
      request,
      user.cookie,
      creds,
    );
    expect(await readHistoricBalances(itemId)).toEqual([]);

    // Act: the receiver syncs the item and writes the history. A new item has no
    // transactions for its first few seconds, so keep asking Plaid to sync.
    let reads = 0;
    const rows = await waitFor(
      async () => {
        if (reads++ % 8 === 0) {
          await fireSandboxWebhook(
            creds,
            accessToken,
            "TRANSACTIONS",
            "SYNC_UPDATES_AVAILABLE",
          );
        }
        return readHistoricBalances(itemId);
      },
      (list) => list.length > 0,
      "the balance history to be written",
    );

    // Assert: what the accounts and transactions say, read over HTTP.
    const accounts = (
      (await (
        await request.get("/api/accounts", {
          headers: withSession(user.cookie),
        })
      ).json()) as { data: { accounts: ListedAccount[] } }
    ).data.accounts.filter((account) => account.connection.id === itemId);
    const transactions = (
      (await (
        await request.get(`/api/transactions?itemId=${itemId}&limit=10000`, {
          headers: withSession(user.cookie),
        })
      ).json()) as { data: { transactions: ListedTransaction[] } }
    ).data.transactions.filter((transaction) => !transaction.pending);
    const first = transactions
      .map((transaction) => transaction.date.slice(0, 10))
      .sort()[0]!;
    const yesterday = day(-1);

    for (const account of accounts) {
      const stored = rows.filter((row) => row.accountId === account.id);
      if (account.balanceCurrent === null) {
        // Nothing to rebuild a history from.
        expect(stored).toEqual([]);
        continue;
      }

      // A row for every day from the first transaction to yesterday, none for
      // today (today is the live balance), each with the balance worked out
      // independently above, the account's currency and the user.
      const expected = expectedBalances(
        account,
        transactions,
        first,
        yesterday,
      );
      expect(stored.map((row) => row.date)).toEqual([...expected.keys()]);
      for (const row of stored) {
        expect(row.balanceCurrent).toBeCloseTo(expected.get(row.date)!, 4);
        expect(row.isoCurrencyCode).toBe(account.isoCurrencyCode);
        expect(row.userId).toBe(user.userId);
      }
    }
    expect(rows.some((row) => row.date >= day(0))).toBe(false);

    // And once: another sync leaves the rows exactly as they were (the same
    // rows with the same creation times, not rewritten).
    const syncedBefore = (await readItem(request, user.cookie, itemId))
      .syncedAt;
    await fireSandboxWebhook(
      creds,
      accessToken,
      "TRANSACTIONS",
      "SYNC_UPDATES_AVAILABLE",
    );
    await waitFor(
      () => readItem(request, user.cookie, itemId),
      (item) =>
        item.syncedAt !== null &&
        new Date(item.syncedAt).getTime() >
          new Date(syncedBefore ?? 0).getTime(),
      "the item to be synced again",
    );
    const fingerprint = (list: StoredHistoricBalance[]) =>
      list.map((row) => [row.accountId, row.date, row.createdAt.getTime()]);
    expect(fingerprint(await readHistoricBalances(itemId))).toEqual(
      fingerprint(rows),
    );
  });
});
