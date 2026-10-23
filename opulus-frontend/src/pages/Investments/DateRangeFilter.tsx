import { HOLDINGS_PRESETS, type HoldingsRange } from '@opulus/core/dto';
import * as React from 'react';

import { DateRangeFilter as DateRangeFilterMenu } from '@/common/DateRangeFilter';
import { type DateRangeValue } from '@/common/DateRangePanel';
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
    <DateRangeFilterMenu
      presets={PRESET_LABELS}
      allLabel={rangeTitle({ range: 'all', since: null, until: null })}
      label={label}
      value={value}
      onChange={onChange}
      maxDay={toDay(new Date())}
    />
  );
};
