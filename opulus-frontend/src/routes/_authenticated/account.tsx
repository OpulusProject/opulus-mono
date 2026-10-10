import { createFileRoute } from '@tanstack/react-router';

import { Account } from '@/pages/Account';

export const Route = createFileRoute('/_authenticated/account')({
  staticData: { title: 'Account' },
  component: Account,
});
