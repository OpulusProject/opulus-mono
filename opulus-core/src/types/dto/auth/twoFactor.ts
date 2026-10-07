/**
 * Two-factor authentication DTOs
 */

import type { LoginSuccessResponse } from "./login.js";

/**
 * Enable two-factor authentication request
 */
export interface EnableTwoFactorRequest {
  password: string;
  issuer?: string;
}

/**
 * Enable two-factor authentication response
 */
export interface EnableTwoFactorResponse {
  totpURI: string;
  backupCodes: string[];
}

/**
 * Verify TOTP code request
 */
export interface VerifyTotpRequest {
  code: string;
  trustDevice?: boolean;
}

/**
 * Verify TOTP code response
 */
export type VerifyTotpResponse = LoginSuccessResponse;
