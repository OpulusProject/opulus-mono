import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth Client Configuration
 */

const getAuthBaseURL = (): string => {
  return (
    (import.meta.env.VITE_API_URL as string | undefined) ||
    'http://localhost:8080'
  );
};

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),

  // CRITICAL: This tells the browser to send/receive cookies with cross-origin requests
  fetchOptions: {
    credentials: 'include',
  },

  plugins: [
    twoFactorClient({
      // Navigation handled in login form component (preserves network tab for debugging)
    }),
  ],
});
