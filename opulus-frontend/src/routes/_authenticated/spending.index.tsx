import { createFileRoute, redirect } from '@tanstack/react-router';

// Transactions is the only Spending page for now.
export const Route = createFileRoute('/_authenticated/spending/')({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: '/spending/transactions',
      search: location.search as never,
      replace: true,
    });
  },
});
