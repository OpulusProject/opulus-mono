/**
 * Session-related DTOs
 */

/**
 * Session response
 */
export interface SessionResponse {
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      emailVerified: boolean;
      image: string | null;
    };
    session: {
      id: string;
      expiresAt: string;
    };
  };
}

