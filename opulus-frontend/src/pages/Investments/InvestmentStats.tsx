import type { ActivitySummaryResponse } from '@opulus/core/dto';
import * as React from 'react';

import { type SummaryStat, SummaryStats } from '@/common/AccountsOverview';
import { formatMoney } from '@/utils/accountDisplay';

interface InvestmentStatsProps {
  activity: ActivitySummaryResponse['data'];
}

/** What came in and went out over the last twelve months. */
export const InvestmentStats: React.FC<InvestmentStatsProps> = ({
  activity,
}) => {
  const { baseCurrency } = activity;
  const stats: SummaryStat[] = [
    {
      label: 'Dividends & interest',
      value: formatMoney(activity.dividends, baseCurrency),
      detail: 'last 12 months',
    },
    {
      label: 'You added',
      value: formatMoney(activity.addedThisYear, baseCurrency),
      detail: `in ${activity.year}`,
    },
    {
      label: 'Fees',
      value: formatMoney(activity.fees, baseCurrency),
      detail: 'last 12 months',
    },
  ];

  return <SummaryStats stats={stats} />;
};
