import { createFileRoute } from '@tanstack/react-router';

import { OAuthRedirect } from '@/pages/OAuthRedirect';

export const Route = createFileRoute('/_authenticated/oauth-redirect')({
  staticData: { title: 'Connecting your bank' },
  component: OAuthRedirect,
});
