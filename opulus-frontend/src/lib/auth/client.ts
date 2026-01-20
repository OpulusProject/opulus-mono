import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Get the base URL for Better Auth
// In production, this should be the backend URL (e.g., https://opulusbackend-production.up.railway.app)
// In development, it's http://localhost:8080
const getAuthBaseURL = (): string => {
  // Use VITE_API_URL if set (same as backend API URL)
  const apiUrl: string =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    'http://localhost:8080';

  // Better Auth is mounted at /api/auth, so we just need the base URL
  return apiUrl;
};

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  fetchOptions: {
    credentials: 'include', // Send cookies with cross-origin requests
  },
  plugins: [
    twoFactorClient({
      // Global handler for 2FA redirects
      // This will be called automatically when signIn.email returns twoFactorRedirect: true
      onTwoFactorRedirect() {
        window.location.href = '/two-factor';
      },
    }),
  ],
});
