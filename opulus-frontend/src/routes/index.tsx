import { createFileRoute, redirect } from '@tanstack/react-router';

import { authClient } from '@/lib/auth/client';

export const Route = createFileRoute('/')({
  // Signed-in users go to the dashboard, everyone else to the login page.
  beforeLoad: async () => {
    let isSignedIn = false;
    try {
      const { data } = await authClient.getSession();
      isSignedIn = Boolean(data?.session);
    } catch {
      // If the session can't be checked (e.g. the API is down), fall back to login.
    }

    throw redirect({
      to: isSignedIn ? '/dashboard' : '/login',
      replace: true,
    });
  },
});
