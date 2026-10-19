import { createFileRoute } from '@tanstack/react-router';

import { InvestmentHoldings } from '@/pages/Investments';
import { holdingsSearchSchema } from '@/pages/Investments/searchSchema';

export const Route = createFileRoute('/_authenticated/investments/holdings')({
  validateSearch: (search) => holdingsSearchSchema.parse(search),
  staticData: { title: 'Investment holdings' },
  component: InvestmentHoldings,
});
