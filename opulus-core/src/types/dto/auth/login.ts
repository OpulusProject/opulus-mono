/**
 * Login-related DTOs
 */

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Successful login response
 */
export interface LoginSuccessResponse {
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

/**
 * Two-factor authentication redirect response
 * Returned when user needs to verify TOTP code
 */
export interface TwoFactorRedirectResponse {
  twoFactorRedirect: true;
}

/**
 * Login response - can be either success or 2FA redirect
 */
export type LoginResponse = LoginSuccessResponse | TwoFactorRedirectResponse;
