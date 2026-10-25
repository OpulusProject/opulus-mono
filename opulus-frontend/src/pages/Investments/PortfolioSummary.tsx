import type { HoldingsResponse } from '@opulus/core/dto';
import * as React from 'react';

import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/accountDisplay';
import { formatGain, gainTone, sinceLabel } from '@/utils/investmentDisplay';

import { AllocationDonut } from './AllocationDonut';
import { EstimatedDividendsLine } from './EstimatedDividendsLine';

interface PortfolioSummaryProps {
  data: HoldingsResponse['data'];
  /** The numbers shown are the previous ones, while new ones load. */
  isRefreshing?: boolean;
}

/** What the user's investments are worth, how they have done, and what they are made of. */
export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  data,
  isRefreshing = false,
}) => {
  const { summary, baseCurrency } = data;
  const hasGain = summary.costBasis > 0;

  return (
    <section
      aria-label="Portfolio summary"
      aria-busy={isRefreshing}
      className={cn(
        // The height holds with a few kinds or many, so the page below stays put.
        'flex flex-col gap-6 rounded-md border p-4 transition-opacity lg:grid lg:min-h-64 lg:grid-cols-2 lg:items-center lg:gap-0 lg:p-8',
        isRefreshing && 'opacity-60'
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5 lg:pr-10">
        <div className="text-muted-foreground text-sm">
          Total value · {summary.accountCount}{' '}
          {summary.accountCount === 1 ? 'account' : 'accounts'} ·{' '}
          {summary.holdingCount}{' '}
          {summary.holdingCount === 1 ? 'holding' : 'holdings'}
        </div>
        <div className="text-3xl font-semibold tracking-tight tabular-nums lg:text-4xl">
          {formatMoney(summary.value, baseCurrency)}
        </div>
        <EstimatedDividendsLine
          amount={summary.estimatedDividends}
          currency={baseCurrency}
          perYear={data.range === 'all'}
        />
        {hasGain && (
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn('tabular-nums', gainTone(summary.gain))}
            >
              {formatGain(summary.gain, summary.gainPercent, baseCurrency)}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {sinceLabel(data)}
            </span>
          </div>
        )}
      </div>
      {/* The divider is the left edge of the right half: the card's middle. */}
      <div className="min-w-0 lg:self-stretch lg:border-l lg:pl-10">
        <AllocationDonut
          slices={summary.allocation}
          baseCurrency={baseCurrency}
        />
      </div>
    </section>
  );
};
