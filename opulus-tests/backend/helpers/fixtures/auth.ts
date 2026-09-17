import { type APIRequestContext } from "@playwright/test";
import { extractSessionCookie, uniqueEmail, uniqueId } from "../client.js";
import { expectOk } from "../assertions.js";

/**
 * Auth fixtures — create session state THROUGH better-auth's email/password
 * endpoints (never by touching the store). Every spec that needs an
 * authenticated caller goes through one of these builders.
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
