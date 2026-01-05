import { createFileRoute } from '@tanstack/react-router';

import { TwoFactor } from '@/pages/TwoFactor';

export const Route = createFileRoute('/two-factor')({
  component: TwoFactor,
});

