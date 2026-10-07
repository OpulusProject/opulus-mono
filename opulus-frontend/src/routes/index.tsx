import { createFileRoute, redirect } from '@tanstack/react-router';

import { isSignedIn } from '@/lib/auth/isSignedIn';

export const Route = createFileRoute('/')({
  // Signed-in users go to the dashboard, everyone else to the login page.
  beforeLoad: async () => {
    throw redirect({
      to: (await isSignedIn()) ? '/dashboard' : '/login',
      replace: true,
    });
  },
});
