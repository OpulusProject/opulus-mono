import * as React from 'react';

import { Calendar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fromDay, toDay } from '@/utils/dateRange';

/**
 * The presets beside a range calendar, for the content of a popover: a preset
 * applies on its own; picking days on the calendar is a custom range.
 */
export function DateRangePanel<P extends string>({
  presets,
  allLabel,
  value,
  onChange,
  onPreset,
  stacked,
  maxDay,
}: DateRangePanelProps<P>) {
  const choose = (range: P | undefined) => {
    onChange({ range, from: undefined, to: undefined });
    onPreset?.();
  };

  return (
    <div className={cn('flex flex-col', stacked ? 'w-min' : 'sm:flex-row')}>
      <div
        role="radiogroup"
        aria-label="Date range"
        className={cn(
          'flex flex-wrap gap-1 border-b p-2',
          !stacked &&
            'sm:w-40 sm:shrink-0 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0'
        )}
      >
        <PresetItem selected={!value.range} onClick={() => choose(undefined)}>
          {allLabel}
        </PresetItem>
        {(Object.keys(presets) as P[]).map((preset) => (
          <PresetItem
            key={preset}
            selected={value.range === preset}
            onClick={() => choose(preset)}
          >
            {presets[preset]}
          </PresetItem>
        ))}
      </div>
      <Calendar
        mode="range"
        numberOfMonths={1}
        defaultMonth={value.from ? fromDay(value.from) : undefined}
        disabled={maxDay ? { after: fromDay(maxDay) } : undefined}
        selected={{
          from: value.from ? fromDay(value.from) : undefined,
          to: value.to ? fromDay(value.to) : undefined,
        }}
        onSelect={(range) =>
          onChange({
            range: range?.from ? 'custom' : undefined,
            from: range?.from ? toDay(range.from) : undefined,
            to: range?.to ? toDay(range.to) : undefined,
          })
        }
      />
    </div>
  );
}

interface DateRangePanelProps<P extends string> {
  /** The presets, by key, with the label each shows. */
  presets: Record<P, string>;
  /** The label of the choice that sets no range (any time, all time). */
  allLabel: string;
  value: DateRangeValue<P>;
  onChange: (value: DateRangeValue<P>) => void;
  /** Called after a preset is chosen, e.g. to close the popover. */
  onPreset?: () => void;
  /** Always put the presets above the calendar, as narrow as the calendar. */
  stacked?: boolean;
  /** The last day that can be picked (`YYYY-MM-DD`); later days are disabled. */
  maxDay?: string;
}

/** What a date filter is set to: a preset, or a custom range of days. */
export interface DateRangeValue<P extends string> {
  /** None is the filter's "all" choice. */
  range?: P | 'custom';
  /** The first and last day of a custom range, as `YYYY-MM-DD`. */
  from?: string;
  to?: string;
}

interface PresetItemProps extends React.ComponentProps<'button'> {
  selected: boolean;
}

/** One preset in the date popover: a radio-style button. */
const PresetItem: React.FC<PresetItemProps> = ({
  selected,
  children,
  ...props
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    className={cn(
      'hover:bg-accent rounded-md px-2 py-1.5 text-left text-sm transition-colors',
      selected && 'bg-accent font-medium'
    )}
    {...props}
  >
    {children}
  </button>
);
