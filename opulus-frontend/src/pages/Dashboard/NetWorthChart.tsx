import type { NetWorthPointDTO } from '@opulus/core/dto';
import { curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';
import { scaleLinear } from '@visx/scale';
import { AreaClosed, LinePath } from '@visx/shape';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { type NetWorthTone, TONE_CLASS } from './netWorthTone';

/**
 * A net worth line for a range: a filled line with no axes, a dashed line at
 * where the range started, and a marker you can move along it with a finger,
 * the pointer or the arrow keys. Fills the width it is given.
 */
export const NetWorthChart: React.FC<NetWorthChartProps> = (props) => (
  // pan-y: a vertical drag still scrolls the page; a horizontal one scrubs.
  <div className="h-40 w-full touch-pan-y select-none">
    <ParentSize>
      {({ width, height }) =>
        width > 0 && height > 0 ? (
          <Chart {...props} width={width} height={height} />
        ) : null
      }
    </ParentSize>
  </div>
);

interface NetWorthChartProps {
  points: NetWorthPointDTO[];
  /** How the range went, which colors the line. */
  tone: NetWorthTone;
  /** The point being looked at (with a finger, the pointer or the arrow keys). */
  activeIndex: number | null;
  onActiveIndexChange: (index: number | null) => void;
  /** Describes the chart for screen readers. */
  label: string;
}

const MARGIN = { top: 8, bottom: 8, left: 4, right: 4 };

const Chart: React.FC<
  NetWorthChartProps & { width: number; height: number }
> = ({
  points,
  tone,
  activeIndex,
  onActiveIndexChange,
  label,
  width,
  height,
}) => {
  const gradientId = React.useId();
  const last = points.length - 1;

  const xScale = React.useMemo(
    () =>
      scaleLinear({
        domain: [0, Math.max(last, 1)],
        range: [MARGIN.left, width - MARGIN.right],
      }),
    [last, width]
  );

  const yScale = React.useMemo(() => {
    const values = points.map((point) => point.netWorth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Room above and below the line; a flat line sits in the middle.
    const pad = (max - min) * 0.15 || Math.max(Math.abs(max) * 0.05, 1);
    return scaleLinear({
      domain: [min - pad, max + pad],
      range: [height - MARGIN.bottom, MARGIN.top],
    });
  }, [points, height]);

  const indexAt = (event: React.PointerEvent<SVGRectElement>) => {
    const point = localPoint(event);
    if (!point) return null;
    return Math.min(last, Math.max(0, Math.round(xScale.invert(point.x))));
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const current = activeIndex ?? last;
    const next =
      event.key === 'ArrowLeft'
        ? current - 1
        : event.key === 'ArrowRight'
          ? current + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next !== null) {
      event.preventDefault();
      onActiveIndexChange(Math.min(last, Math.max(0, next)));
    } else if (event.key === 'Escape') {
      onActiveIndexChange(null);
    }
  };

  const active = activeIndex === null ? null : points[activeIndex];
  const baselineY = yScale(points[0]?.netWorth ?? 0);

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => onActiveIndexChange(null)}
      className={cn(
        'focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]',
        TONE_CLASS[tone]
      )}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.25} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Where the range started, so the line reads as up or down from it. */}
      <line
        x1={MARGIN.left}
        x2={width - MARGIN.right}
        y1={baselineY}
        y2={baselineY}
        className="stroke-muted-foreground/40"
        strokeDasharray="3 4"
      />

      <AreaClosed
        data={points}
        x={(_, index) => xScale(index)}
        y={(point) => yScale(point.netWorth)}
        yScale={yScale}
        curve={curveMonotoneX}
        fill={`url(#${gradientId})`}
      />
      <LinePath
        data={points}
        x={(_, index) => xScale(index)}
        y={(point) => yScale(point.netWorth)}
        curve={curveMonotoneX}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {active && activeIndex !== null && (
        <g pointerEvents="none">
          <line
            x1={xScale(activeIndex)}
            x2={xScale(activeIndex)}
            y1={MARGIN.top}
            y2={height - MARGIN.bottom}
            className="stroke-muted-foreground/50"
          />
          <circle
            cx={xScale(activeIndex)}
            cy={yScale(active.netWorth)}
            r={4.5}
            fill="currentColor"
            className="stroke-background"
            strokeWidth={2}
          />
        </g>
      )}

      {/* Catches the pointer over the whole chart. */}
      <rect
        width={width}
        height={height}
        fill="transparent"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          onActiveIndexChange(indexAt(event));
        }}
        onPointerMove={(event) => onActiveIndexChange(indexAt(event))}
        onPointerLeave={() => onActiveIndexChange(null)}
        onPointerCancel={() => onActiveIndexChange(null)}
        onPointerUp={(event) => {
          // A finger leaving the screen ends the scrub; a mouse stays put.
          if (event.pointerType !== 'mouse') onActiveIndexChange(null);
        }}
      />
    </svg>
  );
};
