import type { AllocationKind } from '@opulus/core/dto';
import * as React from 'react';

import { DonutChart } from '@/common/DonutChart';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/accountDisplay';
import { ALLOCATION_LABELS } from '@/utils/investmentDisplay';

interface Slice {
  kind: AllocationKind;
  value: number;
  share: number;
}

/**
 * One colour for each kind, so a kind looks the same wherever it appears. The
 * Okabe-Ito set, made to stay apart for colour-blind viewers: neighbours differ
 * in lightness as well as hue.
 */
const KIND_COLOR: Record<AllocationKind, string> = {
  etf: '#0072B2',
  balance: '#56B4E9',
  bond: '#E69F00',
  stock: '#009E73',
  option: '#CC79A7',
  mutualFund: '#D55E00',
  cash: '#8A94A6',
  other: '#B08968',
};

interface AllocationDonutProps {
  slices: Slice[];
  baseCurrency: string;
}

/**
 * The portfolio by kind: a ring and a legend with each kind's value. A kind's
 * share is in the hover state: hovering its slice or its legend row grows the
 * slice and reads the share out in the hole.
 */
export const AllocationDonut: React.FC<AllocationDonutProps> = ({
  slices,
  baseCurrency,
}) => {
  const [active, setActive] = React.useState<string>();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 sm:flex-row sm:gap-8">
      <DonutChart
        aria-label="Portfolio by kind"
        className="size-44 shrink-0"
        slices={slices.map((slice) => ({
          key: slice.kind,
          label: ALLOCATION_LABELS[slice.kind],
          value: slice.value,
          share: slice.share,
          color: KIND_COLOR[slice.kind],
        }))}
        formatValue={(value) => formatMoney(value, baseCurrency)}
        activeKey={active}
        onActiveKeyChange={setActive}
      />
      <ul
        className="flex w-full min-w-0 flex-col gap-0.5 sm:flex-1"
        onMouseLeave={() => setActive(undefined)}
      >
        {slices.map((slice) => (
          <li
            key={slice.kind}
            onMouseEnter={() => setActive(slice.kind)}
            className={cn(
              '-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors',
              active === slice.kind && 'bg-muted/60'
            )}
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: KIND_COLOR[slice.kind] }}
            />
            <span className="min-w-0 flex-1 truncate">
              {ALLOCATION_LABELS[slice.kind]}
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
