import { type APIRequestContext } from "@playwright/test";
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
