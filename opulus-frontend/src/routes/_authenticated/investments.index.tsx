import { createFileRoute } from '@tanstack/react-router';

import { Investments } from '@/pages/Investments';

export const Route = createFileRoute('/_authenticated/investments/')({
  staticData: { title: 'Investments' },
  component: Investments,
});
