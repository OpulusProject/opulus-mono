import { expect, test, type APIRequestContext } from "@playwright/test";
import { expectOk } from "../../../shared/assertions.js";
import { uniqueId } from "../../../shared/client.js";
import {
  countSecurities,
  createAuthedUser,
  readHoldings,
} from "../../../shared/fixtures/index.js";
import { resetPlaidStub, setPlaidHoldings } from "../../../shared/plaid-stub.js";
import { answer, apple, cash, holding, microsoft } from "../../../shared/scenarios/plaid-investments.js";
import { linkInstitution, plaidAccount, updateItemAccounts } from "../../../shared/scenarios/plaid.js";

/** A brokerage account in Plaid's shape, as the stub describes it to the accounts call. */
const brokerage = (id: string) =>
  plaidAccount(id, {
    name: `Brokerage ${id}`,
    type: "investment",
    subtype: "brokerage",
    mask: "1234",
    balances: { available: null, current: 5000, limit: null, iso_currency_code: "CAD", unofficial_currency_code: null },
  });

/** Link a brokerage with these accounts; holdings are synced as part of linking. Returns the item's id. */
async function link(request: APIRequestContext, cookie: string, accountIds: string[]) {
  const { itemId } = await linkInstitution(request, cookie, {
    accounts: accountIds.map(brokerage),
    institutionName: "Stub Brokerage",
  });
  return itemId;
}

const updateAccounts = updateItemAccounts;

/**
 * This file: what an item's investment holdings look like after the backend
 * syncs them, which it does when an institution is linked and again when its
 * accounts are updated (answered by the Plaid stub). A sync replaces what an
 * account held, and an institution with no investments to give never fails
 * linking or updating.
 */
test.describe("investment holdings synced by linking and updating (Plaid stub)", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("stores the securities and holdings Plaid reports when an institution is linked", async ({
    request,
  }) => {
    // Arrange: a stock with a cost basis and cash with none.
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const [aapl, cad] = [uniqueId("sec_aapl"), uniqueId("sec_cad")];
    await setPlaidHoldings(
      answer(
        [account],
        [holding(account, aapl, 10, 190.25, 1500), holding(account, cad, 250, 1, null, "CAD")],
        [apple(aapl), cash(cad)],
      ),
    );

    // Act
    const itemId = await link(request, cookie, [account]);

    // Assert
    const stored = await readHoldings(itemId);
    expect(stored.map((h) => h.security.tickerSymbol)).toEqual(["AAPL", "CAD"]);
    expect(stored[0]).toMatchObject({ itemId, isoCurrencyCode: "USD" });
    expect(Number(stored[0]!.quantity)).toBe(10);
    expect(Number(stored[0]!.institutionPrice)).toBe(190.25);
    expect(Number(stored[0]!.institutionValue)).toBe(1902.5);
    expect(Number(stored[0]!.costBasis)).toBe(1500);
    expect(stored[0]!.security).toMatchObject({ name: "Apple Inc.", type: "equity", isCashEquivalent: false });
    expect(stored[1]!.costBasis).toBeNull();
    expect(stored[1]!.security.isCashEquivalent).toBe(true);
  });

  test("links an institution that has no investments to give, with no holdings stored", async ({
    request,
  }) => {
    // Arrange: Plaid says the product is not supported for this item.
    const { cookie } = await createAuthedUser(request);
    await setPlaidHoldings({ error_code: "PRODUCTS_NOT_SUPPORTED" });

    // Act
    const itemId = await link(request, cookie, [uniqueId("acct")]);

    // Assert: linking worked (201 in link), and nothing was stored.
    expect(await readHoldings(itemId)).toEqual([]);
  });

  test("ignores a holding in an account that is not the item's or in a security Plaid did not describe", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const [aapl, mystery] = [uniqueId("sec_aapl"), uniqueId("sec_unknown")];
    await setPlaidHoldings(
      answer(
        [account],
        [
          holding(account, aapl, 3, 190),
          holding("not-this-items-account", aapl, 99, 190),
          holding(account, mystery, 5, 10),
        ],
        [apple(aapl)],
      ),
    );

    // Act
    const itemId = await link(request, cookie, [account]);

    // Assert: only the first holding is stored.
    const stored = await readHoldings(itemId);
    expect(stored).toHaveLength(1);
    expect(Number(stored[0]!.quantity)).toBe(3);
  });

  test("shares one security row between users who hold it", async ({ request }) => {
    // Arrange: two users each hold the same security at their own institution.
    const security = uniqueId("sec_shared");
    const hold = async () => {
      const { cookie } = await createAuthedUser(request);
      const account = uniqueId("acct");
      await setPlaidHoldings(answer([account], [holding(account, security, 2, 190)], [apple(security)]));
      return link(request, cookie, [account]);
    };

    // Act
    const [first, second] = [await hold(), await hold()];

    // Assert: a holding each, one security between them.
    expect(await readHoldings(first)).toHaveLength(1);
    expect(await readHoldings(second)).toHaveLength(1);
    expect(await countSecurities(security)).toBe(1);
  });

  test("replaces what the account held when its accounts are updated: changed holdings change, sold ones go", async ({
    request,
  }) => {
    // Arrange: linked while holding two securities.
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const [aapl, msft] = [uniqueId("sec_aapl"), uniqueId("sec_msft")];
    await setPlaidHoldings(answer([account], [holding(account, aapl, 1, 190), holding(account, msft, 2, 400)], [apple(aapl), microsoft(msft)]));
    const itemId = await link(request, cookie, [account]);
    expect(await readHoldings(itemId)).toHaveLength(2);

    // Act: Plaid now reports only AAPL, with a new quantity.
    await setPlaidHoldings(answer([account], [holding(account, aapl, 7, 200)], [apple(aapl)]));
    await expectOk(await updateAccounts(request, cookie, itemId));

    // Assert: MSFT (sold) is gone, AAPL has the new quantity (updated, not duplicated).
    const stored = await readHoldings(itemId);
    expect(stored.map((h) => h.security.tickerSymbol)).toEqual(["AAPL"]);
    expect(Number(stored[0]!.quantity)).toBe(7);
  });

  test("an account that sold everything ends up with no holdings after an update", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const aapl = uniqueId("sec_aapl");
    await setPlaidHoldings(answer([account], [holding(account, aapl, 4, 190)], [apple(aapl)]));
    const itemId = await link(request, cookie, [account]);
    expect(await readHoldings(itemId)).toHaveLength(1);

    // Act: Plaid answers for the account, with nothing in it.
    await setPlaidHoldings(answer([account], [], []));
    await expectOk(await updateAccounts(request, cookie, itemId));

    // Assert
    expect(await readHoldings(itemId)).toEqual([]);
  });

  test("leaves the stored holdings alone when the institution can no longer give them", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const account = uniqueId("acct");
    const aapl = uniqueId("sec_aapl");
    await setPlaidHoldings(answer([account], [holding(account, aapl, 4, 190)], [apple(aapl)]));
    const itemId = await link(request, cookie, [account]);

    // Act: the update finds the product needs consent again.
    await setPlaidHoldings({ error_code: "ADDITIONAL_CONSENT_REQUIRED" });
    await expectOk(await updateAccounts(request, cookie, itemId));

    // Assert: what was stored stays, and the update itself succeeded.
    const stored = await readHoldings(itemId);
    expect(stored).toHaveLength(1);
    expect(Number(stored[0]!.quantity)).toBe(4);
  });
});
