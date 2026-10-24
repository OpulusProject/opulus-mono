import { createFileRoute } from '@tanstack/react-router';

import { Overview } from '@/pages/Spending';

export const Route = createFileRoute('/_authenticated/spending/')({
  staticData: { title: 'Spending' },
  component: Overview,
});
