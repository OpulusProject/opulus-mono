import type { AllocationKind } from '@opulus/core/dto';
import * as React from 'react';

import { DonutChart } from '@/common/DonutChart';
import { formatMoney } from '@/utils/accountDisplay';
import { ALLOCATION_LABELS, formatPercent } from '@/utils/investmentDisplay';

interface Slice {
  kind: AllocationKind;
  value: number;
  share: number;
}

/** One colour for each kind, so a kind looks the same wherever it appears. */
const KIND_COLOR: Record<AllocationKind, string> = {
  etf: '#3b82f6',
  stock: '#10b981',
  mutualFund: '#8b5cf6',
  bond: '#f59e0b',
  option: '#ec4899',
  cash: '#94a3b8',
  other: '#78716c',
  balance: '#06b6d4',
};

interface AllocationDonutProps {
  slices: Slice[];
  baseCurrency: string;
}

/**
 * The portfolio by kind: a ring and a legend with each kind's value and
 * share. The legend carries the numbers; the ring shows them on hover.
 */
export const AllocationDonut: React.FC<AllocationDonutProps> = ({
  slices,
  baseCurrency,
}) => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 sm:flex-row sm:gap-8">
      <DonutChart
        aria-label="Portfolio by kind"
        className="size-44 shrink-0"
        slices={slices.map((slice) => ({
          key: slice.kind,
          label: ALLOCATION_LABELS[slice.kind],
          value: slice.value,
          color: KIND_COLOR[slice.kind],
        }))}
        formatValue={(value) => formatMoney(value, baseCurrency)}
      />
      <ul className="flex w-full min-w-0 flex-col gap-2.5 sm:flex-1">
        {slices.map((slice) => (
          <li key={slice.kind} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: KIND_COLOR[slice.kind] }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {ALLOCATION_LABELS[slice.kind]}
              </span>
              <span className="text-muted-foreground block text-xs tabular-nums">
                {formatPercent(slice.share, 0)}
              </span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              {formatMoney(slice.value, baseCurrency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
