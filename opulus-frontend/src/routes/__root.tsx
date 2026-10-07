import { Outlet, createRootRoute, redirect } from '@tanstack/react-router';

import { isSignedIn } from '@/lib/auth/isSignedIn';

/**
 * Pages a signed-out visitor may see. Every other page needs a signed-in user,
 * so a page added without being listed here is protected by default. `/` is
 * listed because it decides where to send the visitor itself.
 */
const PUBLIC_PATHS = new Set(['/', '/login', '/two-factor']);

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (PUBLIC_PATHS.has(path)) return;

    if (!(await isSignedIn())) {
      throw redirect({ to: '/login', replace: true });
    }
  },
  component: () => <Outlet />,
});
