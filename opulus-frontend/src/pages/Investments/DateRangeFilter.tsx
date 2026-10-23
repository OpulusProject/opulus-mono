import { HOLDINGS_PRESETS, type HoldingsRange } from '@opulus/core/dto';
import { CalendarDays, ChevronDown } from 'lucide-react';
import * as React from 'react';

import { DateRangePanel, type DateRangeValue } from '@/common/DateRangePanel';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui';
import { toDay } from '@/utils/dateRange';
import { rangeTitle } from '@/utils/investmentDisplay';

import { type OverviewSearch, holdingsPeriod } from './searchSchema';

type Preset = (typeof HOLDINGS_PRESETS)[number];

const PRESET_LABELS = Object.fromEntries(
  HOLDINGS_PRESETS.map((preset) => [
    preset,
    rangeTitle({ range: preset, since: null, until: null }),
  ])
) as Record<Preset, string>;

interface DateRangeFilterProps {
  search: Pick<OverviewSearch, 'range' | 'from' | 'to'>;
  onChange: (changes: Pick<OverviewSearch, 'range' | 'from' | 'to'>) => void;
}

/**
 * A popover for choosing the period the gains are over: a dashed button with a
 * calendar icon saying the period, opening the presets (past day to year to
 * date, and all time) beside a calendar for a custom range. Days after today
 * cannot be picked.
 */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  search,
  onChange,
}) => {
  const [open, setOpen] = React.useState(false);
  const period = holdingsPeriod(search);
  const range: HoldingsRange = period.range ?? 'all';
  const label = rangeTitle({
    range,
    since: period.from ?? null,
    until: period.to ?? null,
  });
  const value: DateRangeValue<Preset> = {
    range: period.range as DateRangeValue<Preset>['range'],
    from: period.from,
    to: period.to,
  };

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
          presets={PRESET_LABELS}
          allLabel={rangeTitle({ range: 'all', since: null, until: null })}
          value={value}
          onChange={onChange}
          onPreset={() => setOpen(false)}
          maxDay={toDay(new Date())}
        />
      </PopoverContent>
    </Popover>
  );
};
