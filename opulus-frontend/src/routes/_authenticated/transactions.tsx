import { createFileRoute, redirect } from '@tanstack/react-router';

// Transactions moved under Spending; keep old links and bookmarks working.
export const Route = createFileRoute('/_authenticated/transactions')({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: '/spending/transactions',
      search: location.search as never,
      replace: true,
    });
  },
});
