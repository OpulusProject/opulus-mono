import type {
  ActivitySummaryResponse,
  HoldingsResponse,
} from '@opulus/core/dto';
import * as React from 'react';

import { type SummaryStat, SummaryStats } from '@/common/AccountsOverview';
import { formatMoney } from '@/utils/accountDisplay';
import { formatPercent, formatSignedMoney } from '@/utils/investmentDisplay';

interface InvestmentStatsProps {
  activity: ActivitySummaryResponse['data'];
  /** With the holdings, a fourth number joins them: the total return. */
  holdings?: HoldingsResponse['data'];
}

/**
 * What came in over the last twelve months, and (on the overview) the total
 * return: the gain plus the dividends. Cash is never part of the gain.
 */
export const InvestmentStats: React.FC<InvestmentStatsProps> = ({
  activity,
  holdings,
}) => {
  const { baseCurrency } = activity;
  const stats: SummaryStat[] = [
    {
      label: 'Dividends & interest',
      value: formatMoney(activity.dividends, baseCurrency),
      detail: holdings
        ? `last 12 months · ${formatPercent(holdings.summary.dividendYield)} of value`
        : 'last 12 months',
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

  if (holdings && holdings.summary.totalReturnPercent !== null) {
    const { totalReturn, totalReturnPercent } = holdings.summary;
    stats.push({
      label: 'Total return',
      value: formatSignedMoney(totalReturn, baseCurrency),
      detail: `gain plus dividends · ${formatPercent(totalReturnPercent)} of what you paid`,
    });
  }

  return <SummaryStats stats={stats} />;
};
