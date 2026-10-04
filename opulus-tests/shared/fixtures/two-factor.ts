import { type APIRequestContext } from "@playwright/test";
import { URI, type TOTP } from "otpauth";
import { extractSessionCookie, withSession } from "../client.js";
import { expectOk } from "../assertions.js";
import { signUp, TEST_PASSWORD, type TestUser } from "./auth.js";

/**
 * Two-factor (TOTP) fixtures for the better-auth `twoFactor` plugin.
 *
 * Unlike Plaid, this flow is fully deterministic offline: `enable` returns an
 * otpauth:// URI whose secret we can read to compute the current TOTP with
 * otpauth, letting us drive the real enable → verify → enabled path over HTTP.
 */

/** Compute the current 6-digit TOTP code from an otpauth:// URI (from enable). */
export function currentTotp(totpUri: string): string {
  return (URI.parse(totpUri) as TOTP).generate();
}

/**
 * Enable 2FA for an authenticated user. This only provisions the secret — the
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

export interface TwoFactorUser extends TestUser {
  totpUri: string;
  backupCodes: string[];
}

/**
 * Create a user and fully enable 2FA (enable → confirm with a computed TOTP).
 * The confirming verify-totp reissues the session, so the refreshed cookie is
 * returned on `cookie`. `totpUri` lets a spec generate fresh codes.
 */
export async function createUserWithTwoFactor(
  request: APIRequestContext,
): Promise<TwoFactorUser> {
  const user = await signUp(request);
  const { totpUri, backupCodes } = await enableTwoFactor(request, user.cookie);

  const res = await request.post("/api/auth/two-factor/verify-totp", {
    headers: withSession(user.cookie),
    data: { code: currentTotp(totpUri) },
  });
  await expectOk(res);

  return { ...user, cookie: extractSessionCookie(res), totpUri, backupCodes };
}
