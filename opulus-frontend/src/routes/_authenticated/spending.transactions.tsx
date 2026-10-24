import { createFileRoute } from '@tanstack/react-router';

import { Transactions } from '@/pages/Spending';
import { transactionsSearchSchema } from '@/pages/Spending/Transactions/searchSchema';

export const Route = createFileRoute('/_authenticated/spending/transactions')({
  validateSearch: (search) => transactionsSearchSchema.parse(search),
  staticData: { title: 'Transactions' },
  component: Transactions,
});
