import { type APIRequestContext } from "@playwright/test";
import { URI, type TOTP } from "otpauth";
import {
  cookiesFrom,
  extractSessionCookie,
  uniqueEmail,
  uniqueId,
  uniqueIp,
  withSession,
} from "../client.js";
import { expectOk } from "../assertions.js";

/**
 * Auth fixtures — create session state THROUGH better-auth's email/password
 * endpoints (never by touching the store). Every spec that needs an
 * authenticated caller goes through one of these builders.
 */

/**
 * The password test users sign up with. It is a common one, which is fine for
 * the service suite (breached-password checking is off there), but the
 * integration suite checks passwords against Have I Been Pwned, so CI gives it a
 * strong one through TEST_PASSWORD.
 */
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "testpass123";

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
    headers: { "x-forwarded-for": uniqueIp() },
    data: { email, password, name },
  });
  await expectOk(res);

  const body = await res.json();
  return { email, password, name, cookie: extractSessionCookie(res), user: body.user };
}

/**
 * The authenticator-app secret (an otpauth URI) of each user a spec enrolled in
 * two-factor, by email, so `signIn` can answer the second-factor challenge.
 */
const totpUris = new Map<string, string>();

/** Compute the current 6-digit TOTP code from an otpauth:// URI (from enable). */
export function currentTotp(totpUri: string): string {
  return (URI.parse(totpUri) as TOTP).generate();
}

/**
 * Enable 2FA for an authenticated user. This only provisions the secret: the
 * account is not actually protected until a verify-totp confirms it. Returns the
 * otpauth URI and backup codes.
 */
export async function enableTwoFactor(
  request: APIRequestContext,
  cookie: string,
  password: string = TEST_PASSWORD,
): Promise<{ totpUri: string; backupCodes: string[] }> {
  const res = await request.post("/api/auth/two-factor/enable", {
    headers: withSession(cookie),
    data: { password },
  });
  await expectOk(res);
  const body = await res.json();
  return { totpUri: body.totpURI, backupCodes: body.backupCodes };
}

export type EnrolledUser = TestUser & { totpUri: string; backupCodes: string[] };

/**
 * Set up two-factor for a signed-up user (enable, then confirm with a computed
 * code). The API serves a user nothing but their session until they have done
 * this. Confirming reissues the session, so the refreshed cookie is on `cookie`.
 */
export async function enrollTwoFactor(
  request: APIRequestContext,
  user: TestUser,
): Promise<EnrolledUser> {
  const { totpUri, backupCodes } = await enableTwoFactor(
    request,
    user.cookie,
    user.password,
  );
  const res = await request.post("/api/auth/two-factor/verify-totp", {
    headers: withSession(user.cookie),
    data: { code: currentTotp(totpUri) },
  });
  await expectOk(res);
  totpUris.set(user.email, totpUri);
  return { ...user, cookie: extractSessionCookie(res), totpUri, backupCodes };
}

/**
 * Sign in an existing user and return the issued session cookie. A user who set
 * up two-factor (see `enrollTwoFactor`) is asked for a code after the password;
 * it is answered here, so the result is a session either way.
 */
export async function signIn(
  request: APIRequestContext,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<{ cookie: string; user: { id: string; email: string } }> {
  const headers = { "x-forwarded-for": uniqueIp() };
  const res = await request.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password },
  });
  await expectOk(res);
  const body = await res.json();

  if (body.twoFactorRedirect) {
    const totpUri = totpUris.get(email);
    if (!totpUri) {
      throw new Error(`${email} has two-factor, but this run does not know its secret`);
    }
    const verified = await request.post("/api/auth/two-factor/verify-totp", {
      headers: { ...headers, cookie: cookiesFrom(res) },
      data: { code: currentTotp(totpUri) },
    });
    await expectOk(verified);
    return {
      cookie: extractSessionCookie(verified),
      user: (await verified.json()).user,
    };
  }

  return { cookie: extractSessionCookie(res), user: body.user };
}

/**
 * Create a user and return an authenticated session cookie + id in one step. The
 * user has set up two-factor, because the API serves nothing but the session to
 * a user who has not; use `signUp` for a user who has not.
 */
export async function createAuthedUser(
  request: APIRequestContext,
  overrides: Partial<{ email: string; password: string }> = {},
): Promise<{ cookie: string; userId: string; email: string }> {
  const u = await enrollTwoFactor(request, await signUp(request, overrides));
  return { cookie: u.cookie, userId: u.user.id, email: u.email };
}
