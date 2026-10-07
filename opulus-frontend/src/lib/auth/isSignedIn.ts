import { authClient } from '@/lib/auth/client';

/**
 * Whether there is a signed-in session. Used by route guards, so a session that
 * can't be checked (e.g. the API is down) counts as signed out.
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    const { data } = await authClient.getSession();
    return Boolean(data?.session);
  } catch {
    return false;
  }
}
