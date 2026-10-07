/**
 * Get Session endpoint DTOs
 */

import { toIsoString } from "../common.js";

export interface SessionUserDTO {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
}

/**
 * Session response
 */
export interface SessionResponse {
  data: {
    user: SessionUserDTO;
    session: {
      id: string;
      expiresAt: string;
    };
  };
}

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
