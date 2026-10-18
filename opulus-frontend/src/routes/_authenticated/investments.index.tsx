import { createFileRoute } from '@tanstack/react-router';

import { Investments } from '@/pages/Investments';
import { overviewSearchSchema } from '@/pages/Investments/searchSchema';

export const Route = createFileRoute('/_authenticated/investments/')({
  validateSearch: (search) => overviewSearchSchema.parse(search),
  staticData: { title: 'Overview', section: 'Investments' },
  component: Investments,
});
