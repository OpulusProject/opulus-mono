/**
 * Login-related DTOs
 *
 * Sign-in and two-factor requests and responses are handled by better-auth,
 * not our controllers, so only the form's shape lives here.
 */

import { z } from "zod";

/**
 * Login request payload (the fields of the login form)
 */
export const LoginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
  rememberMe: z.boolean().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
