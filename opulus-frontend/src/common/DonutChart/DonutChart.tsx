import * as React from 'react';
import { Cell, Pie, PieChart } from 'recharts';

import { type ChartConfig, ChartContainer } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * A ring split into slices, shadcn's pie chart in its donut form. Hovering a
 * slice grows it outward (as in shadcn's "Donut Active"), dims the others and
 * reads out its name, share of the whole and value in the hole. It draws only
 * the ring; put a legend beside it for the numbers.
 *
 * @example
 * <DonutChart
 *   aria-label="Portfolio by kind"
 *   className="size-44"
 *   slices={[
 *     { key: 'etf', label: 'ETFs', value: 600, share: 0.6, color: '#0072B2' },
 *   ]}
 *   formatValue={(value) => formatMoney(value, 'CAD')}
 * />
 */
export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  formatValue,
  activeKey,
  onActiveKeyChange,
  className,
  ...props
}) => {
  // The parent owns the lit slice when it passes `onActiveKeyChange`.
  const [ownKey, setOwnKey] = React.useState<string>();
  const current = onActiveKeyChange ? activeKey : ownKey;
  const setActive = (key: string | undefined) => {
    setOwnKey(key);
    onActiveKeyChange?.(key);
  };

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
  const lit = slices.find((slice) => slice.key === current);
  // The readout stays mounted and fades, so it keeps the last slice's text
  // while it fades out.
  const lastLit = React.useRef(lit);
  if (lit) lastLit.current = lit;
  const shown = lit ?? lastLit.current;

  return (
    <div
      className={cn(
        'animate-in fade-in relative aspect-square duration-700',
        className
      )}
    >
      <ChartContainer
        config={config}
        role="img"
        aria-label={props['aria-label']}
        className="aspect-square size-full"
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius="68%"
            outerRadius="92%"
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            // The ring fades in with its container instead of sweeping round.
            isAnimationActive={false}
            onMouseEnter={(_, index) => setActive(slices[index]?.key)}
            onMouseLeave={() => setActive(undefined)}
          >
            {slices.map((slice) => (
              <Cell
                key={slice.key}
                fill={`var(--color-${slice.key})`}
                style={{
                  // About the middle of the chart: the transition is on the
                  // cell, which stays mounted, so it eases both ways.
                  transformOrigin: '50% 50%',
                  transformBox: 'view-box',
                  transform:
                    slice.key === current ? `scale(${ACTIVE_SCALE})` : 'none',
                  opacity:
                    current && slice.key !== current ? DIMMED_OPACITY : 1,
                  transition: `transform ${EASE}, opacity ${EASE}`,
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        {shown && (
          <div
            style={{
              opacity: lit ? 1 : 0,
              transform: lit ? 'scale(1)' : 'scale(0.94)',
              transition: `opacity ${EASE}, transform ${EASE}`,
            }}
          >
            <div className="text-muted-foreground text-xs">{shown.label}</div>
            <div className="text-2xl leading-8 font-semibold tracking-tight tabular-nums">
              {Math.round(shown.share * 100)}%
            </div>
            <div className="text-muted-foreground text-xs tabular-nums">
              {formatValue(shown.value)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface DonutChartProps {
  slices: DonutSlice[];
  /** How a slice's value reads in the readout, e.g. as money. */
  formatValue: (value: number) => string;
  /**
   * The slice that is lit, when the parent also lights it (a legend row under
   * the pointer). Pass it with `onActiveKeyChange`; without them the chart
   * tracks the pointer itself.
   */
  activeKey?: string;
  onActiveKeyChange?: (key: string | undefined) => void;
  /** Describes the chart for screen readers. */
  'aria-label': string;
  /** Sets the size, e.g. `size-44`; the chart is square. */
  className?: string;
}

/** How much the lit slice grows, and how far the others dim. */
const ACTIVE_SCALE = 1.09;
const DIMMED_OPACITY = 0.4;
/** One easing for every fade and grow, slow in and slow out. */
const EASE = '320ms cubic-bezier(0.4, 0, 0.2, 1)';

export interface DonutSlice {
  /** Identifies the slice. Letters and digits only: it names a CSS variable. */
  key: string;
  label: string;
  value: number;
  /** The slice's fraction of the whole (0.57 is 57%), worked out by the caller: shown on hover. */
  share: number;
  /** Any CSS colour, e.g. `#3b82f6` or `hsl(var(--chart-1))`. */
  color: string;
}
