/**
 * Login-related DTOs
 */

import { z } from "zod";

/**
 * Login request payload
 */
export const LoginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
  rememberMe: z.boolean().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * The user returned when authentication succeeds
 */
export const AuthenticatedUserDTOSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  emailVerified: z.boolean(),
});

export type AuthenticatedUserDTO = z.infer<typeof AuthenticatedUserDTOSchema>;

/**
 * The session returned when authentication succeeds
 */
export const AuthenticatedSessionDTOSchema = z.object({
  id: z.string(),
  token: z.string(),
  expiresAt: z.string(),
});

export type AuthenticatedSessionDTO = z.infer<
  typeof AuthenticatedSessionDTOSchema
>;

/**
 * Successful login response
 */
export const LoginSuccessResponseSchema = z.object({
  user: AuthenticatedUserDTOSchema,
  session: AuthenticatedSessionDTOSchema,
});

export type LoginSuccessResponse = z.infer<typeof LoginSuccessResponseSchema>;

/**
 * Two-factor authentication redirect response
 * Returned when user needs to verify TOTP code
 */
export const TwoFactorRedirectResponseSchema = z.object({
  twoFactorRedirect: z.literal(true),
});

export type TwoFactorRedirectResponse = z.infer<
  typeof TwoFactorRedirectResponseSchema
>;

/**
 * Login response - can be either success or 2FA redirect
 */
export const LoginResponseSchema = z.union([
  LoginSuccessResponseSchema,
  TwoFactorRedirectResponseSchema,
]);

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
