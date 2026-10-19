import * as React from 'react';
import { Pie, PieChart } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * A ring split into slices, shadcn's pie chart in its donut form: each slice
 * takes the colour it is given, and hovering one shows its label and value.
 * It draws only the ring; put a legend beside it for the numbers.
 *
 * @example
 * <DonutChart
 *   aria-label="Portfolio by kind"
 *   className="size-44"
 *   slices={[{ key: 'etf', label: 'ETFs', value: 600, color: '#3b82f6' }]}
 *   formatValue={(value) => formatMoney(value, 'CAD')}
 * />
 */
export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  formatValue,
  className,
  ...props
}) => {
  const config = Object.fromEntries(
    slices.map((slice) => [
      slice.key,
      { label: slice.label, color: slice.color },
    ])
  ) satisfies ChartConfig;
  const data = slices.map((slice) => ({
    key: slice.key,
    value: slice.value,
    fill: `var(--color-${slice.key})`,
  }));

  return (
    <ChartContainer
      config={config}
      role="img"
      aria-label={props['aria-label']}
      className={cn('aspect-square', className)}
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              nameKey="key"
              formatter={(value, name) => {
                // `name` is the slice's key (see `nameKey`).
                const slice = slices.find((entry) => entry.key === name);
                return (
                  <div className="flex w-full items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: slice?.color }}
                    />
                    <span className="text-muted-foreground">
                      {slice?.label}
                    </span>
                    <span className="ml-auto font-mono font-medium tabular-nums">
                      {formatValue(Number(value))}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="key"
          innerRadius="68%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          strokeWidth={0}
        />
      </PieChart>
    </ChartContainer>
  );
};

interface DonutChartProps {
  slices: DonutSlice[];
  /** How a slice's value reads in the tooltip, e.g. as money. */
  formatValue: (value: number) => string;
  /** Describes the chart for screen readers. */
  'aria-label': string;
  /** Sets the size, e.g. `size-44`; the chart is square. */
  className?: string;
}

export interface DonutSlice {
  /** Identifies the slice. Letters and digits only: it names a CSS variable. */
  key: string;
  label: string;
  value: number;
  /** Any CSS colour, e.g. `#3b82f6` or `hsl(var(--chart-1))`. */
  color: string;
}
