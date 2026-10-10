import { createFileRoute } from '@tanstack/react-router';

import { CreditAndLoans } from '@/pages/CreditAndLoans';

export const Route = createFileRoute('/_authenticated/credit-and-loans')({
  staticData: { title: 'Credit & loans' },
  component: CreditAndLoans,
});
