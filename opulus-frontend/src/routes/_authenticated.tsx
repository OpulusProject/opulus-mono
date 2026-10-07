import { createFileRoute, redirect } from '@tanstack/react-router';

import { isSignedIn } from '@/lib/auth/isSignedIn';

/**
 * Layout for every page that needs a signed-in user. It renders no UI of its
 * own: it only checks the session, and sends signed-out visitors to the login
 * page. Put a page in the `_authenticated` folder to protect it.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    if (!(await isSignedIn())) {
      throw redirect({ to: '/login', replace: true });
    }
  },
});
