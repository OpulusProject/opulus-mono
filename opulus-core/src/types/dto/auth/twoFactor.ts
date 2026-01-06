/**
 * Two-factor authentication DTOs
 */

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
export interface VerifyTotpResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
  };
  session: {
    id: string;
    token: string;
    expiresAt: string;
  };
}

