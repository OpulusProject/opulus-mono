/**
 * Two-factor authentication DTOs
 */

import { z } from "zod";

import { LoginSuccessResponseSchema } from "./login.js";

/**
 * Enable two-factor authentication request
 */
export const EnableTwoFactorRequestSchema = z.object({
  password: z.string(),
  issuer: z.string().optional(),
});

export type EnableTwoFactorRequest = z.infer<
  typeof EnableTwoFactorRequestSchema
>;

/**
 * Enable two-factor authentication response
 */
export const EnableTwoFactorResponseSchema = z.object({
  totpURI: z.string(),
  backupCodes: z.array(z.string()),
});

export type EnableTwoFactorResponse = z.infer<
  typeof EnableTwoFactorResponseSchema
>;

/**
 * Verify TOTP code request
 */
export const VerifyTotpRequestSchema = z.object({
  code: z.string(),
  trustDevice: z.boolean().optional(),
});

export type VerifyTotpRequest = z.infer<typeof VerifyTotpRequestSchema>;

/**
 * Verify TOTP code response
 */
export const VerifyTotpResponseSchema = LoginSuccessResponseSchema;

export type VerifyTotpResponse = z.infer<typeof VerifyTotpResponseSchema>;
