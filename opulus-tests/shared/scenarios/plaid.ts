import { expect, type APIRequestContext } from "@playwright/test";
import { uniqueId, withSession } from "../client.js";
import { createAuthedUser } from "../fixtures/auth.js";
import { setPlaidItem } from "../plaid-stub.js";

/** An account in Plaid's shape, as the Plaid stub describes it to the accounts call. */
export function plaidAccount(id: string, overrides: Record<string, unknown> = {}) {
  return {
    account_id: id,
    name: `Chequing ${id}`,
    official_name: null,
    type: "depository",
    subtype: "checking",
    mask: "0000",
    balances: { available: 100, current: 100, limit: null, iso_currency_code: "CAD", unofficial_currency_code: null },
    ...overrides,
  };
}

/**
 * Make the Plaid stub describe an institution with these accounts, and return the
 * id to link it by. For a test that does the linking itself (to check the
 * response, or to link twice).
 */
export async function describeInstitution(
  accounts: Record<string, unknown>[],
  name = "Stub Bank",
): Promise<string> {
  const institutionId = uniqueId("ins");
  await setPlaidItem({ institution_id: institutionId, institution_name: name, accounts });
  return institutionId;
}

/**
 * Link an institution through the backend (the Plaid stub answers the exchange,
 * item, institution, accounts and the calls that follow) and return the new
 * item's id. The sync that follows a link has run when this returns.
 */
export async function linkInstitution(
  request: APIRequestContext,
  cookie: string,
  options: { accounts?: Record<string, unknown>[]; institutionName?: string } = {},
): Promise<{ itemId: string; institutionId: string }> {
  const institutionId = await describeInstitution(
    options.accounts ?? [plaidAccount(uniqueId("acct"))],
    options.institutionName,
  );
  const res = await request.post("/api/items", {
    headers: withSession(cookie),
    data: { publicToken: uniqueId("public-stub"), institutionId },
  });
  expect(res.status(), await res.text()).toBe(201);
  return { itemId: (await res.json()).data.itemId as string, institutionId };
}

/** A signed-in user (two-factor set up) who has linked one institution. */
export async function createLinkedUser(
  request: APIRequestContext,
  options: Parameters<typeof linkInstitution>[2] = {},
) {
  const user = await createAuthedUser(request);
  return { ...user, ...(await linkInstitution(request, user.cookie, options)) };
}

/** Update an item's accounts (which syncs what follows a link again). Returns the response. */
export function updateItemAccounts(request: APIRequestContext, cookie: string, itemId: string) {
  return request.post(`/api/items/${itemId}/update-accounts`, { headers: withSession(cookie) });
}

