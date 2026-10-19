import * as React from 'react';

import { cn } from '@/lib/utils';

import type { DonutSlice } from './DonutChart';

interface DonutLegendProps {
  /** The same slices as the chart beside it. */
  slices: DonutSlice[];
  /** How a slice's value reads, e.g. as money. */
  formatValue: (value: number) => string;
  /**
   * The slice that is lit, and what to do when the pointer lights another (or
   * leaves the list). Pass the same pair to the chart, so a row under the
   * pointer lights its slice and a slice under the pointer lights its row.
   */
  activeKey?: string;
  onActiveKeyChange?: (key: string | undefined) => void;
  className?: string;
}

/**
 * The key to a `DonutChart`: a row for each slice with its colour, label and
 * value. Pair it with the chart and the same `activeKey` / `onActiveKeyChange`.
 *
 * @example
 * const [active, setActive] = React.useState<string>();
 * <DonutChart slices={slices} activeKey={active} onActiveKeyChange={setActive} … />
 * <DonutLegend slices={slices} activeKey={active} onActiveKeyChange={setActive} formatValue={format} />
 */
export const DonutLegend: React.FC<DonutLegendProps> = ({
  slices,
  formatValue,
  activeKey,
  onActiveKeyChange,
  className,
}) => (
  <ul
    className={cn('flex min-w-0 flex-col gap-0.5', className)}
    onMouseLeave={() => onActiveKeyChange?.(undefined)}
  >
    {slices.map((slice) => (
      <li
        key={slice.key}
        onMouseEnter={() => onActiveKeyChange?.(slice.key)}
        className={cn(
          '-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors',
          activeKey === slice.key && 'bg-muted/60'
        )}
      >
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-[3px]"
          style={{ backgroundColor: slice.color }}
        />
        <span className="min-w-0 flex-1 truncate">{slice.label}</span>
        <span className="shrink-0 text-right tabular-nums">
          {formatValue(slice.value)}
        </span>
      </li>
    ))}
  </ul>
);
