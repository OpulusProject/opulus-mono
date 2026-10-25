import { createFileRoute } from '@tanstack/react-router';

import { Trends } from '@/pages/Spending';

export const Route = createFileRoute('/_authenticated/spending/trends')({
  staticData: { title: 'Trends' },
  component: Trends,
});
