import { CalendarDays, ChevronDown } from 'lucide-react';
import * as React from 'react';

import { DateRangePanel, type DateRangeValue } from '@/common/DateRangePanel';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui';

interface DateRangeFilterProps<P extends string> {
  /** The presets, by key, with the label each shows. */
  presets: Record<P, string>;
  /** The label of the choice that sets no range (all time, any time). */
  allLabel: string;
  /** What the button says: the period as it is now set. */
  label: string;
  value: DateRangeValue<P>;
  onChange: (value: DateRangeValue<P>) => void;
  /** The last day that can be picked (`YYYY-MM-DD`); later days are disabled. */
  maxDay?: string;
}

/**
 * A popover for choosing a period for the whole page: a dashed button with a
 * calendar icon saying the period, opening the presets beside a calendar for a
 * custom range. The page keeps the value in its URL.
 */
export function DateRangeFilter<P extends string>({
  presets,
  allLabel,
  label,
  value,
  onChange,
  maxDay,
}: DateRangeFilterProps<P>) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed font-normal"
          aria-label={`Period: ${label}`}
        >
          <CalendarDays />
          {label}
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-max max-w-[var(--radix-popover-content-available-width)] p-0"
      >
        <DateRangePanel
          presets={presets}
          allLabel={allLabel}
          value={value}
          onChange={onChange}
          onPreset={() => setOpen(false)}
          maxDay={maxDay}
        />
      </PopoverContent>
    </Popover>
  );
}
