import { createFileRoute } from '@tanstack/react-router';

import { Transactions } from '@/pages/Transactions';
import { transactionsSearchSchema } from '@/pages/Transactions/searchSchema';

export const Route = createFileRoute('/_authenticated/transactions')({
  validateSearch: (search) => transactionsSearchSchema.parse(search),
  component: Transactions,
});
