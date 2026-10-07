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
 * The user returned when authentication succeeds
 */
export interface AuthenticatedUserDTO {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

/**
 * The session returned when authentication succeeds
 */
export interface AuthenticatedSessionDTO {
  id: string;
  token: string;
  expiresAt: string;
}

/**
 * Successful login response
 */
export interface LoginSuccessResponse {
  user: AuthenticatedUserDTO;
  session: AuthenticatedSessionDTO;
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
