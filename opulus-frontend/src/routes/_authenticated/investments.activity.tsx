import { createFileRoute } from '@tanstack/react-router';

import { InvestmentActivity } from '@/pages/Investments';
import { activitySearchSchema } from '@/pages/Investments/searchSchema';

export const Route = createFileRoute('/_authenticated/investments/activity')({
  validateSearch: (search) => activitySearchSchema.parse(search),
  staticData: { title: 'Activity', section: 'Investments' },
  component: InvestmentActivity,
});
