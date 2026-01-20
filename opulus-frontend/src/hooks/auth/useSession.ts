import { authClient } from '@/lib/auth/client';

/**
 * Hook to get the current session
 * Uses Better Auth's useSession hook which provides reactive session data
 * @returns Session data, loading state, error, and refetch function
 */
export function useSession() {
  return authClient.useSession();
}
