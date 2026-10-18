import { expect, test } from "@playwright/test";
import { readItemAccessToken } from "../../../shared/db.js";
import { seedItemWithAccount, seedUser, readWebhookEvents, readLiabilities, seedCreditLiability } from "../../../shared/fixtures/index.js";
import { resetPlaidStub, setPlaidLiabilities } from "../../../shared/plaid-stub.js";
import { liabilitiesFor } from "../../../shared/scenarios/plaid.js";
import { deliverWebhook } from "../helpers/fixtures/index.js";

/** A user with one linked item and its account, and the access token the stub knows them by. */
async function linkedItem() {
  const user = await seedUser();
  const item = await seedItemWithAccount(user.id);
  return { ...item, accessToken: await readItemAccessToken(item.itemId) };
}

const liabilitiesWebhook = (plaidItemId: string, extra: Record<string, unknown> = {}) => ({
  webhook_type: "LIABILITIES",
  webhook_code: "DEFAULT_UPDATE",
  item_id: plaidItemId,
  ...extra,
});

/**
 * This file: what the worker does with a LIABILITIES DEFAULT_UPDATE webhook,
 * which says Plaid has new or updated liabilities for some of an item's
 * accounts. The worker asks Plaid (the stub) for those accounts' liabilities and
 * stores them, in place when the account already has one. What it stored is read
 * from the test DB.
 *
 * Test cases:
 * - stores the liabilities Plaid reports for the accounts the webhook lists
 * - refreshes an account's stored liability in place
 * - does not ask Plaid when the update carries an error
 * - keeps what it had when Plaid has no liabilities to give
 */
test.describe("LIABILITIES webhooks", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("stores the liabilities Plaid reports for the accounts the webhook lists", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    await setPlaidLiabilities({
      response: { liabilities: { credit: liabilitiesFor({ credit: item.providerAccountId, mortgage: "x", student: "y" }).credit } },
    });

    // Act
    await deliverWebhook(request, liabilitiesWebhook(item.plaidItemId, { account_ids_with_new_liabilities: [item.providerAccountId] }));

    // Assert
    const [stored, ...rest] = await readLiabilities(item.itemId);
    expect(rest).toEqual([]);
    expect(stored).toMatchObject({ accountId: item.accountId, kind: "credit", isOverdue: false });
    expect(Number(stored!.minimumPayment)).toBe(25);
    expect(Number(stored!.lastStatementBalance)).toBe(450.12);
  });

  test("refreshes an account's stored liability in place", async ({ request }) => {
    // Arrange: a liability stored earlier, with an older minimum payment.
    const user = await seedUser();
    const item = await seedItemWithAccount(user.id);
    await seedCreditLiability({ userId: user.id, itemId: item.itemId, accountId: item.accountId, overrides: { minimumPayment: 99 } });
    const credit = liabilitiesFor({ credit: item.providerAccountId, mortgage: "x", student: "y" }).credit!;
    await setPlaidLiabilities({ response: { liabilities: { credit } } });

    // Act
    await deliverWebhook(
      request,
      liabilitiesWebhook(item.plaidItemId, { account_ids_with_updated_liabilities: { [item.providerAccountId]: ["minimum_payment_amount"] } }),
    );

    // Assert: one liability for the account, now with Plaid's figure.
    const stored = await readLiabilities(item.itemId);
    expect(stored).toHaveLength(1);
    expect(Number(stored[0]!.minimumPayment)).toBe(25);
  });

  test("does not ask Plaid when the update carries an error", async ({ request }) => {
    // Arrange: Plaid would answer, if it were asked.
    const item = await linkedItem();
    const credit = liabilitiesFor({ credit: item.providerAccountId, mortgage: "x", student: "y" }).credit!;
    await setPlaidLiabilities({ response: { liabilities: { credit } } });

    // Act
    await deliverWebhook(
      request,
      liabilitiesWebhook(item.plaidItemId, {
        account_ids_with_new_liabilities: [item.providerAccountId],
        error: { error_type: "ITEM_ERROR", error_code: "ITEM_LOGIN_REQUIRED", error_message: "login required" },
      }),
    );

    // Assert: handled, nothing stored.
    expect(await readLiabilities(item.itemId)).toEqual([]);
    expect(await readWebhookEvents(item.plaidItemId)).toMatchObject([{ status: "processed", attempts: 1 }]);
  });

  test("keeps what it had when Plaid has no liabilities to give", async ({ request }) => {
    // Arrange: nothing set, so the stub answers PRODUCTS_NOT_SUPPORTED, as for an institution without liabilities.
    const user = await seedUser();
    const item = await seedItemWithAccount(user.id);
    await seedCreditLiability({ userId: user.id, itemId: item.itemId, accountId: item.accountId });

    // Act
    await deliverWebhook(request, liabilitiesWebhook(item.plaidItemId, { account_ids_with_new_liabilities: [item.providerAccountId] }));

    // Assert
    expect(await readLiabilities(item.itemId)).toHaveLength(1);
    expect(await readWebhookEvents(item.plaidItemId)).toMatchObject([{ status: "processed", attempts: 1 }]);
  });
});
