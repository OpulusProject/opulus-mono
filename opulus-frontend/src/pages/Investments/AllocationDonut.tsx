import type { AllocationKind } from '@opulus/core/dto';
import * as React from 'react';

import { DonutChart, DonutLegend, type DonutSlice } from '@/common/DonutChart';
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
  const donutSlices: DonutSlice[] = slices.map((slice) => ({
    key: slice.kind,
    label: ALLOCATION_LABELS[slice.kind],
    value: slice.value,
    share: slice.share,
    color: KIND_COLOR[slice.kind],
  }));
  const formatValue = (value: number) => formatMoney(value, baseCurrency);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 sm:flex-row sm:gap-8">
      <DonutChart
        aria-label="Portfolio by kind"
        className="size-44 shrink-0"
        slices={donutSlices}
        formatValue={formatValue}
        activeKey={active}
        onActiveKeyChange={setActive}
      />
      <DonutLegend
        className="w-full sm:flex-1"
        slices={donutSlices}
        formatValue={formatValue}
        activeKey={active}
        onActiveKeyChange={setActive}
      />
    </div>
  );
};
