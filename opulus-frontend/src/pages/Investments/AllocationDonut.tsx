import type { AllocationKind } from '@opulus/core/dto';
import * as React from 'react';

import { formatMoney } from '@/utils/accountDisplay';
import { ALLOCATION_LABELS, formatPercent } from '@/utils/investmentDisplay';

interface Slice {
  kind: AllocationKind;
  value: number;
  share: number;
}

/** Slices fade from the foreground colour, so no hue has to mean anything. */
const OPACITY = [1, 0.62, 0.4, 0.26, 0.16, 0.1];
const opacityFor = (index: number) =>
  OPACITY[Math.min(index, OPACITY.length - 1)];

const SIZE = 148;
const THICKNESS = 20;
const RADIUS = (SIZE - THICKNESS) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface AllocationDonutProps {
  slices: Slice[];
  baseCurrency: string;
}

/**
 * The portfolio by kind: a ring (drawn as stroked circle segments) and a
 * legend with each kind's value and share. The legend carries the numbers, so
 * the ring is decoration for screen readers.
 */
export const AllocationDonut: React.FC<AllocationDonutProps> = ({
  slices,
  baseCurrency,
}) => {
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        className="text-foreground shrink-0 -rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={THICKNESS}
          className="stroke-muted"
        />
        {slices.map((slice, index) => {
          const length = slice.share * CIRCUMFERENCE;
          const circle = (
            <circle
              key={slice.kind}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeOpacity={opacityFor(index)}
              strokeWidth={THICKNESS}
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return circle;
        })}
      </svg>
      <ul className="flex w-full min-w-0 flex-col gap-2 sm:w-64">
        {slices.map((slice, index) => (
          <li key={slice.kind} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="bg-foreground size-2.5 shrink-0 rounded-full"
              style={{ opacity: opacityFor(index) }}
            />
            <span className="min-w-0 flex-1 truncate">
              {ALLOCATION_LABELS[slice.kind]}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatPercent(slice.share, 0)}
            </span>
            <span className="w-24 text-right tabular-nums">
              {formatMoney(slice.value, baseCurrency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
