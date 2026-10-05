import { createFileRoute } from '@tanstack/react-router';

import { CreditAndLoans } from '@/pages/CreditAndLoans';

export const Route = createFileRoute('/credit-and-loans')({
  component: CreditAndLoans,
});
