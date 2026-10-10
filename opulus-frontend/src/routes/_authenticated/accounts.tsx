import { createFileRoute } from '@tanstack/react-router';

import { Accounts } from '@/pages/Accounts';

export const Route = createFileRoute('/_authenticated/accounts')({
  staticData: { title: 'Accounts' },
  component: Accounts,
});
