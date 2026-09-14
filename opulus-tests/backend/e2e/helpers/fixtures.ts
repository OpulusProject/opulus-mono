import { type APIRequestContext } from "@playwright/test";
import { extractSessionCookie, uniqueEmail, uniqueId } from "./client.js";
import { expectOk } from "./assertions.js";

/**
 * Entity builders and interaction helpers. Every piece of test setup goes
 * through a named function here — never inline API plumbing in a spec.
 *
 * CRITICAL: all state is created THROUGH THE API (better-auth's email/password
 * endpoints), never by writing to Postgres. This keeps the suite portable
 * across any backing store and honors the black-box contract. Namespace new
 * accounts with uniqueEmail()/uniqueId() so tests stay isolated without a
 * shared reset (the backend exposes no test-only reset endpoint).
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

/**
 * Sign up a fresh user via better-auth. Sign-up also establishes a session, so
 * the issued session cookie is returned ready to use.
 *
 * POST /api/auth/sign-up/email
 */
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
  const cookie = extractSessionCookie(res);
  return { email, password, name, cookie, user: body.user };
}

/**
 * Sign in an existing user and return the issued session cookie.
 *
 * POST /api/auth/sign-in/email
 */
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
  const cookie = extractSessionCookie(res);
  return { cookie, user: body.user };
}

/**
 * Create a user and return an authenticated session cookie in one step. Use
 * this when a test just needs "some authenticated user".
 */
export async function createAuthedUser(
  request: APIRequestContext,
  overrides: Partial<{ email: string; password: string }> = {},
): Promise<TestUser> {
  return signUp(request, overrides);
}
