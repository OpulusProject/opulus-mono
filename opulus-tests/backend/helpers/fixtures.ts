import { type APIRequestContext } from "@playwright/test";
import { extractSessionCookie, uniqueEmail, uniqueId } from "./client.js";
import { expectOk } from "./assertions.js";
import { testDb } from "./db.js";

/**
 * Entity builders and interaction helpers. Every piece of test setup goes
 * through a named function here — never inline plumbing in a spec.
 *
 * Prefer creating state THROUGH THE API (better-auth's email/password
 * endpoints). Items / bank accounts / transactions have NO create endpoint
 * (they are born only from the Plaid webhook → exchange → DB write path), so per
 * the service-api-tests skill they are seeded directly into an isolated test DB
 * via the db helper. Verification always happens over HTTP. Namespace everything
 * with uniqueId() so tests stay isolated without a shared reset.
 */

export const TEST_PASSWORD = "testpass123";

export interface TestUser {
  email: string;
  password: string;
  name: string;
  /** `name=value` session cookie pair, ready to replay via withSession(). */
  cookie: string;
  user: { id: string; email: string; name: string };
}

// ---------------------------------------------------------------------------
// API-driven auth builders
// ---------------------------------------------------------------------------

/** Sign up a fresh user via better-auth. Sign-up also establishes a session. */
export async function signUp(
  request: APIRequestContext,
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? TEST_PASSWORD;
  const name = overrides.name ?? uniqueId("Test User");

  const res = await request.post("/api/auth/sign-up/email", {
    data: { email, password, name },
  });
  await expectOk(res);

  const body = await res.json();
  return { email, password, name, cookie: extractSessionCookie(res), user: body.user };
}

/** Sign in an existing user and return the issued session cookie. */
export async function signIn(
  request: APIRequestContext,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<{ cookie: string; user: { id: string; email: string } }> {
  const res = await request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  await expectOk(res);

  const body = await res.json();
  return { cookie: extractSessionCookie(res), user: body.user };
}

/** Create a user and return an authenticated session cookie + id in one step. */
export async function createAuthedUser(
  request: APIRequestContext,
  overrides: Partial<{ email: string; password: string }> = {},
): Promise<{ cookie: string; userId: string; email: string }> {
  const u = await signUp(request, overrides);
  return { cookie: u.cookie, userId: u.user.id, email: u.email };
}

// ---------------------------------------------------------------------------
// DB seeders for resources with no create endpoint (see helpers/db.ts).
// Payload shapes mirror the service's own CreateItemData / CreateTransactionData
// so seeded rows match the real Plaid write path as closely as possible.
// ---------------------------------------------------------------------------

export interface SeededItem {
  itemId: string;
  plaidItemId: string;
  accountId: string;
  accountName: string;
  institutionName: string;
}

/**
 * Seed one Item plus one linked BankAccount for a user, mirroring what the
 * webhooks link handler persists. Returns the ids the read specs need.
 */
export async function seedItemWithAccount(
  userId: string,
  overrides: Partial<{ institutionName: string; accountName: string }> = {},
): Promise<SeededItem> {
  const db = testDb();
  const institutionName = overrides.institutionName ?? uniqueId("Bank");
  const accountName = overrides.accountName ?? uniqueId("Checking");

  const item = await db.item.create({
    data: {
      plaidItemId: uniqueId("plaid_item"),
      userId,
      accessToken: uniqueId("access"),
      institutionId: uniqueId("ins"),
      institutionName,
      updateType: "background",
      availableProducts: ["transactions"],
      billedProducts: ["transactions"],
      products: ["transactions"],
    },
  });

  const account = await db.bankAccount.create({
    data: {
      providerAccountId: uniqueId("acct"),
      itemId: item.id,
      userId,
      name: accountName,
      type: "depository",
      subtype: "checking",
      mask: "0000",
      balanceCurrent: 1000,
      balanceAvailable: 950,
      isoCurrencyCode: "CAD",
    },
  });

  return {
    itemId: item.id,
    plaidItemId: item.plaidItemId,
    accountId: account.id,
    accountName,
    institutionName,
  };
}

/**
 * Seed `count` transactions for a user's seeded item/account. Returns the
 * transaction names so a follow-up API read can assert on exactly what it made.
 */
export async function seedTransactions(
  params: { userId: string; itemId: string; accountId: string; count?: number },
): Promise<{ names: string[]; count: number }> {
  const db = testDb();
  const count = params.count ?? 3;
  const names: string[] = [];

  const data = Array.from({ length: count }, (_, i) => {
    const name = uniqueId(`txn_${i}`);
    names.push(name);
    return {
      providerTransactionId: uniqueId("ptxn"),
      accountId: params.accountId,
      itemId: params.itemId,
      userId: params.userId,
      amount: 12.34 + i,
      date: new Date("2026-01-0" + ((i % 9) + 1)),
      name,
      category: ["Food and Drink"],
      pending: false,
      isoCurrencyCode: "CAD",
    };
  });

  await db.transaction.createMany({ data });
  return { names, count };
}
