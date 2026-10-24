import * as React from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  LabelList,
  BarChart as RechartsBarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * A bar chart, shadcn's bar chart with a horizontal grid, value axis, hover
 * tooltip, an optional reference line and hatched bars for a period that is
 * not over. It draws what it is given and works nothing out.
 *
 * @example
 * <BarChart
 *   aria-label="Spent per month"
 *   points={[{ key: '2026-09', label: 'Sep', value: 4310.55 }]}
 *   formatValue={(value) => formatMoney(value, 'CAD')}
 *   reference={{ value: 4242.11, label: 'Average' }}
 * />
 */
export const BarChart: React.FC<BarChartProps> = ({
  points,
  formatValue,
  formatTick = formatValue,
  reference,
  color = DEFAULT_COLOR,
  onSelect,
  className,
  ...props
}) => {
  const hatchId = `hatch-${React.useId().replace(/:/g, '')}`;
  const config = { value: { label: 'Spent', color } } satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      role="img"
      aria-label={props['aria-label']}
      className={cn('aspect-auto h-72 w-full', className)}
    >
      <RechartsBarChart
        data={points}
        margin={{ top: 24, right: 8, bottom: 0, left: 0 }}
      >
        <defs>
          <pattern
            id={hatchId}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="var(--color-value)" />
            <rect width="4" height="8" fill="white" fillOpacity={0.55} />
          </pattern>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={formatTick}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--color-muted)', opacity: 0.5 }}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(label) =>
                points.find((point) => point.label === label)?.title ??
                String(label)
              }
              formatter={(value) => (
                <span className="font-medium tabular-nums">
                  {formatValue(Number(value))}
                </span>
              )}
            />
          }
        />
        {reference && (
          <ReferenceLine
            y={reference.value}
            stroke="var(--color-muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: reference.label,
              position: 'insideTopRight',
              fontSize: 11,
              fill: 'var(--color-muted-foreground)',
            }}
          />
        )}
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          maxBarSize={64}
          isAnimationActive={false}
          cursor={onSelect ? 'pointer' : undefined}
          onClick={(point) =>
            onSelect?.((point as unknown as BarChartPoint).key)
          }
        >
          {points.map((point) => (
            <Cell
              key={point.key}
              fill={point.partial ? `url(#${hatchId})` : 'var(--color-value)'}
            />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            fontSize={11}
            className="fill-foreground tabular-nums"
            formatter={(value: number) => formatValue(value)}
            content={(label) => {
              const point = points[label.index as number];
              if (!point?.showValue) return null;
              const x = Number(label.x) + Number(label.width) / 2;
              return (
                <text
                  x={x}
                  y={Number(label.y) - 6}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-foreground tabular-nums"
                >
                  {formatValue(point.value)}
                </text>
              );
            }}
          />
        </Bar>
      </RechartsBarChart>
    </ChartContainer>
  );
};

interface BarChartProps {
  points: BarChartPoint[];
  /** How a value reads, e.g. as money. */
  formatValue: (value: number) => string;
  /** How an axis tick reads; shorter than `formatValue`, e.g. `$4k`. */
  formatTick?: (value: number) => string;
  /** A dashed line across the chart, e.g. the average; the server works it out. */
  reference?: { value: number; label: string };
  /** The bar's colour; any CSS colour. */
  color?: string;
  /** A bar was clicked; makes the bars buttons. */
  onSelect?: (key: string) => void;
  /** Describes the chart for screen readers. */
  'aria-label': string;
  className?: string;
}

const DEFAULT_COLOR = '#0072B2';

export interface BarChartPoint {
  /** Identifies the bar, e.g. `2026-10` or `2026-10-23`. */
  key: string;
  /** What the axis says under the bar, e.g. `Oct` or `23`. */
  label: string;
  /** What the tooltip says for the bar, e.g. `October 2026`. Defaults to `label`. */
  title?: string;
  value: number;
  /** The period is not over: the bar is hatched. */
  partial?: boolean;
  /** Write the value above the bar; leave it off on crowded charts. */
  showValue?: boolean;
}
