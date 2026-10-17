/**
 * The control side of the Plaid stub (opulus-tests/services/backend/stub/plaid.mjs),
 * for specs that check what the backend asked Plaid for. The backend runs with
 * PLAID_BASE_URL pointing at the stub, so no real Plaid is involved.
 */
import type {
  AccountBase,
  CreditCardLiability,
  Holding,
  MortgageLiability,
  Security,
  StudentLoan,
  TransactionStream,
  RemovedTransaction,
  Transaction,
} from "plaid";

/**
 * What the stub answers is typed with the SDK's own types, so a field the SDK
 * does not know (a typo, or one Plaid renamed in a newer SDK) fails the
 * type-check instead of passing against a stub that quietly agrees with us.
 */
export type { AccountBase, Holding, Security, Transaction, TransactionStream };

/**
 * The SDK's enums are TypeScript enums, which a plain string such as "checking"
 * does not satisfy, so they are read as the strings they stand for.
 */
type AsPlaid<T> = T extends string
  ? `${T}`
  : T extends (infer Item)[]
    ? AsPlaid<Item>[]
    : T extends object
      ? { [K in keyof T]?: AsPlaid<T[K]> }
      : T;

/** A response type as it travels over the wire: enums are the strings they stand for, required fields stay required. */
export type Wire<T> = T extends string
  ? `${T}`
  : T extends (infer Item)[]
    ? Wire<Item>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;

/**
 * A response object of Plaid's with only the fields a test cares about. Every
 * field that is given must exist in the SDK and have its type, but the many
 * that a test does not use need not be repeated.
 */
export type Plaid<T> = AsPlaid<T> & object;

const STUB_URL = process.env.PLAID_STUB_URL ?? "http://localhost:4546";

/** The link token requests the backend has made to the stub since the last reset, oldest first. */
export async function linkTokenRequests(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${STUB_URL}/__control/requests`);
  return (await res.json()).requests;
}

/** Forget the requests received so far. */
export async function resetPlaidStub(): Promise<void> {
  await fetch(`${STUB_URL}/__control/reset`, { method: "POST" });
}

/** What the stub answers to `/investments/holdings/get`: a response, or a Plaid error code. */
export async function setPlaidHoldings(
  answer:
    | {
        response: { accounts: Plaid<AccountBase>[]; holdings: Plaid<Holding>[]; securities: Plaid<Security>[] };
      }
    | { error_code: string },
): Promise<void> {
  await fetch(`${STUB_URL}/__control/holdings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(answer),
  });
}

/**
 * The institution and accounts the stub describes to the item, institution and
 * accounts calls that linking an institution and updating its accounts make.
 * Account ids are Plaid's; holdings (see `setPlaidHoldings`) refer to them.
 */
export async function setPlaidItem(item: {
  institution_id?: string;
  institution_name?: string;
  accounts: Plaid<AccountBase>[];
}): Promise<void> {
  await fetch(`${STUB_URL}/__control/item`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(item),
  });
}

/** What the stub answers to `/transactions/recurring/get`: a response, or a Plaid error code. */
export async function setPlaidRecurring(
  answer:
    | {
        response: { inflow_streams: Plaid<TransactionStream>[]; outflow_streams: Plaid<TransactionStream>[] };
      }
    | { error_code: string },
): Promise<void> {
  await fetch(`${STUB_URL}/__control/recurring`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(answer),
  });
}

/** The recurring requests the backend has made to the stub since the last reset. */
export async function recurringRequests(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${STUB_URL}/__control/recurring-requests`);
  return (await res.json()).requests;
}

/**
 * The key the stub signs webhooks with, for a test to sign one the receiver will
 * accept: its id, the id of a key the stub reports as expired, and the private
 * key (the stub made it when it started, and it is good for nothing else).
 */
export async function webhookSigningKey(): Promise<{
  kid: string;
  expiredKid: string;
  privateJwk: Record<string, string>;
}> {
  const res = await fetch(`${STUB_URL}/__control/webhook-key`);
  return res.json();
}

/** The access tokens the backend has revoked at Plaid (`/item/remove`) since the last reset. */
export async function removedAccessTokens(): Promise<string[]> {
  const res = await fetch(`${STUB_URL}/__control/removed-items`);
  return (await res.json()).accessTokens;
}

/** Make Plaid refuse to remove items with this error code (an empty call makes it work again). */
export async function failItemRemoval(errorCode?: string): Promise<void> {
  await fetch(`${STUB_URL}/__control/item-remove`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(errorCode ? { error_code: errorCode } : {}),
  });
}

/** The public tokens the backend has exchanged with Plaid since the last reset. */
export async function exchangedPublicTokens(): Promise<string[]> {
  const res = await fetch(`${STUB_URL}/__control/exchanges`);
  return (await res.json()).publicTokens;
}

/** Plaid's liabilities by kind, each with only the fields a test cares about. */
export interface PlaidLiabilities {
  credit?: Plaid<CreditCardLiability>[];
  mortgage?: Plaid<MortgageLiability>[];
  student?: Plaid<StudentLoan>[];
}

/** What the stub answers to `/liabilities/get`: Plaid's liabilities by kind, or a Plaid error code. */
export async function setPlaidLiabilities(
  answer:
    | { response: { liabilities: PlaidLiabilities } }
    | { error_code: string },
): Promise<void> {
  await fetch(`${STUB_URL}/__control/liabilities`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(answer),
  });
}

/** Make Plaid refuse to describe the item's accounts with this ITEM_ERROR code (an empty call makes it work again). */
export async function failAccounts(errorCode?: string): Promise<void> {
  await fetch(`${STUB_URL}/__control/accounts-error`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(errorCode ? { error_code: errorCode } : {}),
  });
}

/** One page of what `/transactions/sync` answers (Plaid's snake_case), or a Plaid error code. */
export type PlaidSyncPage =
  | {
      added?: Plaid<Transaction>[];
      modified?: Plaid<Transaction>[];
      removed?: Plaid<RemovedTransaction>[];
      accounts?: Plaid<AccountBase>[];
      next_cursor?: string;
      has_more?: boolean;
    }
  | { error_code: string };

/**
 * The pages `/transactions/sync` answers, in turn, for one access token (an
 * empty page after that). Per token, so a retried job from another test cannot
 * take them.
 */
export async function setPlaidSyncPages(accessToken: string, pages: PlaidSyncPage[]): Promise<void> {
  await fetch(`${STUB_URL}/__control/transactions-sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, pages }),
  });
}

/** The cursors `/transactions/sync` was asked from for an access token, oldest first (null for the first sync). */
export async function syncCursorsAskedFor(accessToken: string): Promise<(string | null)[]> {
  const res = await fetch(`${STUB_URL}/__control/transactions-sync-cursors?access_token=${encodeURIComponent(accessToken)}`);
  return (await res.json()).cursors;
}
