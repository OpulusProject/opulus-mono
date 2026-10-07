/**
 * Link Token endpoint DTOs
 */

import { z } from "zod";

/**
 * Link token API response
 */
export const LinkTokenResponseSchema = z.object({
  data: z.object({
    linkToken: z.string(),
  }),
});

export type LinkTokenResponse = z.infer<typeof LinkTokenResponseSchema>;
