import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

import { AppLayout } from '@/common/AppLayout';
import { isSignedIn } from '@/lib/auth/isSignedIn';

/**
 * Layout for every page that needs a signed-in user. It sends signed-out
 * visitors to the login page, and wraps the page in the sidebar and header.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    if (!(await isSignedIn())) {
      throw redirect({ to: '/login', replace: true });
    }
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
