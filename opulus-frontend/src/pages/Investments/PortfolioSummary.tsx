import type { HoldingsResponse } from '@opulus/core/dto';
import * as React from 'react';

import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/accountDisplay';
import { formatGain, gainTone } from '@/utils/investmentDisplay';

import { AllocationDonut } from './AllocationDonut';

interface PortfolioSummaryProps {
  data: HoldingsResponse['data'];
}

/** What the user's investments are worth, how they have done, and what they are made of. */
export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ data }) => {
  const { summary, baseCurrency } = data;
  const hasGain = summary.costBasis > 0;

  return (
    <section
      aria-label="Portfolio summary"
      className="flex flex-col gap-6 rounded-md border p-4 lg:flex-row lg:items-center lg:gap-10 lg:p-6"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="text-muted-foreground text-sm">
          Total value · {summary.accountCount}{' '}
          {summary.accountCount === 1 ? 'account' : 'accounts'} ·{' '}
          {summary.holdingCount}{' '}
          {summary.holdingCount === 1 ? 'holding' : 'holdings'}
        </div>
        <div className="text-3xl font-semibold tracking-tight tabular-nums lg:text-4xl">
          {formatMoney(summary.value, baseCurrency)}
        </div>
        {hasGain && (
          <div>
            <Badge
              variant="secondary"
              className={cn('tabular-nums', gainTone(summary.gain))}
            >
              {formatGain(summary.gain, summary.gainPercent, baseCurrency)}
            </Badge>
          </div>
        )}
      </div>
      <div className="bg-border hidden w-px self-stretch lg:block" />
      <AllocationDonut
        slices={summary.allocation}
        baseCurrency={baseCurrency}
      />
    </section>
  );
};
