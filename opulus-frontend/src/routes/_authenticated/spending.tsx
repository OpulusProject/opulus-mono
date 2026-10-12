import { createFileRoute } from '@tanstack/react-router';

import { Spending } from '@/pages/Spending';

export const Route = createFileRoute('/_authenticated/spending')({
  staticData: { title: 'Spending' },
  component: Spending,
});
