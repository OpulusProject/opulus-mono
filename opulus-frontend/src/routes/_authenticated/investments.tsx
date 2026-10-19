import { createFileRoute } from '@tanstack/react-router';

import { Investments } from '@/pages/Investments';
import { investmentsSearchSchema } from '@/pages/Investments/searchSchema';

export const Route = createFileRoute('/_authenticated/investments')({
  validateSearch: (search) => investmentsSearchSchema.parse(search),
  staticData: { title: 'Investments' },
  component: Investments,
});
