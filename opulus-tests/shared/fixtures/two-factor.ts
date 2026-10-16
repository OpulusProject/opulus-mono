import { type APIRequestContext } from "@playwright/test";
import { expectOk } from "../assertions.js";
import { extractCookie, uniqueIp } from "../client.js";
import {
  currentTotp,
  enrollTwoFactor,
  signUp,
  type EnrolledUser,
} from "./auth.js";

/**
 * Two-factor (TOTP) fixtures for the better-auth `twoFactor` plugin.
 *
 * Unlike Plaid, this flow is fully deterministic offline: `enable` returns an
 * otpauth:// URI whose secret we can read to compute the current TOTP with
 * otpauth, letting us drive the real enable → verify → enabled path over HTTP.
 */

/**
 * A guaranteed-wrong TOTP code for the current window. Flips the last digit of
 * the real code so we never accidentally submit the right one.
 */
export function wrongTotp(totpUri: string): string {
  const code = currentTotp(totpUri);
  const last = Number(code[5]);
  return code.slice(0, 5) + ((last + 1) % 10).toString();
}

/**
 * Create a user who has set up 2FA (enable, then confirm with a computed TOTP).
 * `totpUri` lets a spec generate fresh codes and `backupCodes` sign in without
 * one.
 */
export async function createUserWithTwoFactor(
  request: APIRequestContext,
): Promise<EnrolledUser> {
  return enrollTwoFactor(request, await signUp(request));
}

/**
 * The password step of signing in as a user who has two-factor on. No session
 * is issued: the response sets a challenge cookie, which the second step
 * (verify-totp, or verify-backup-code) replays. Returns that cookie.
 */
export async function startTwoFactorSignIn(
  request: APIRequestContext,
  user: { email: string; password: string },
): Promise<{ challengeCookie: string }> {
  const res = await request.post("/api/auth/sign-in/email", {
    headers: { "x-forwarded-for": uniqueIp() },
    data: { email: user.email, password: user.password },
  });
  await expectOk(res);
  if (!(await res.json()).twoFactorRedirect) {
    throw new Error("Expected a two-factor challenge, got a session");
  }
  return { challengeCookie: extractCookie(res, "two_factor") };
}
