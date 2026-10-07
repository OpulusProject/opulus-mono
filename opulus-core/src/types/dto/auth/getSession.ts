/**
 * Get Session endpoint DTOs
 */

import { z } from "zod";

import { IsoTimestampSchema, toIsoString } from "../common.js";

export const SessionUserDTOSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
});

export type SessionUserDTO = z.infer<typeof SessionUserDTOSchema>;

/**
 * Session response
 */
export const SessionResponseSchema = z.object({
  data: z.object({
    user: SessionUserDTOSchema,
    session: z.object({
      id: z.string(),
      expiresAt: IsoTimestampSchema,
    }),
  }),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/**
 * Transform an auth session to the public session DTO. The auth library
 * returns more user fields (timestamps, flags) than the client needs, so only
 * the documented ones are passed through.
 */
export function toSessionDTO(session: {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    image?: string | null;
  };
  session: { id: string; expiresAt: Date };
}): SessionResponse["data"] {
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified,
      image: session.user.image ?? null,
    },
    session: {
      id: session.session.id,
      expiresAt: toIsoString(session.session.expiresAt),
    },
  };
}
