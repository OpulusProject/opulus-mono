import { expect, type APIRequestContext } from "@playwright/test";
import { uniqueId, withSession } from "../client.js";
import { createAuthedUser } from "../fixtures/auth.js";
import { setPlaidItem, type AccountBase, type Plaid, type PlaidLiabilities } from "../plaid-stub.js";

/** An account in Plaid's shape, as the Plaid stub describes it to the accounts call. */
export function plaidAccount(id: string, overrides: Plaid<AccountBase> = {}): Plaid<AccountBase> {
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
  accounts: Plaid<AccountBase>[],
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
  options: { accounts?: Plaid<AccountBase>[]; institutionName?: string } = {},
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

/** A credit card account in Plaid's shape. */
export const creditCardAccount = (id: string) =>
  plaidAccount(id, {
    name: `Card ${id}`,
    type: "credit",
    subtype: "credit card",
    mask: "4444",
    balances: { available: 4000, current: 1000, limit: 5000, iso_currency_code: "CAD", unofficial_currency_code: null },
  });

/** A loan account (a mortgage, or a student loan) in Plaid's shape. */
export const loanAccount = (id: string, subtype: "mortgage" | "student") =>
  plaidAccount(id, {
    name: `${subtype === "mortgage" ? "Mortgage" : "Student loan"} ${id}`,
    type: "loan",
    subtype,
    mask: "7777",
    balances: { available: null, current: 20000, limit: null, iso_currency_code: "CAD", unofficial_currency_code: null },
  });

/** Plaid's liabilities for a credit card, a mortgage and a student loan, one each. */
export function liabilitiesFor(ids: { credit: string; mortgage: string; student: string }): PlaidLiabilities {
  return {
    credit: [
      {
        account_id: ids.credit,
        aprs: [{ apr_percentage: 19.99, apr_type: "purchase_apr", balance_subject_to_apr: 900, interest_charge_amount: 15 }],
        is_overdue: false,
        last_payment_amount: 100,
        last_payment_date: "2026-09-15",
        last_statement_balance: 450.12,
        last_statement_issue_date: "2026-09-01",
        minimum_payment_amount: 25,
        next_payment_due_date: "2026-10-25",
      },
    ],
    mortgage: [
      {
        account_id: ids.mortgage,
        interest_rate: { percentage: 3.99, type: "fixed" },
        loan_type_description: "conventional",
        loan_term: "30 year",
        maturity_date: "2046-01-01",
        next_monthly_payment: 1500,
        next_payment_due_date: "2026-11-01",
        origination_date: "2016-01-01",
        origination_principal_amount: 425000,
        past_due_amount: 0,
        ytd_interest_paid: 12000,
        ytd_principal_paid: 6000,
      },
    ],
    student: [
      {
        account_id: ids.student,
        is_overdue: false,
        loan_name: "Consolidation",
        loan_status: { type: "repayment", end_date: "2030-01-01" },
        minimum_payment_amount: 138.05,
        next_payment_due_date: "2026-10-25",
        origination_date: "2015-01-01",
        origination_principal_amount: 25000,
        outstanding_interest_amount: 1200,
        repayment_plan: { type: "standard", description: "Standard" },
        interest_rate_percentage: 5.25,
        expected_payoff_date: "2032-01-01",
        ytd_interest_paid: 900,
        ytd_principal_paid: 1100,
      },
    ],
  };
}

