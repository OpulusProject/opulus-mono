import * as React from 'react';

import { DateRangeFilter } from '@/common/DateRangeFilter';
import type { DateRangeValue } from '@/common/DateRangePanel';
import {
  RANGE_LABELS,
  type RangePreset,
  formatCustomRange,
  toDay,
} from '@/utils/dateRange';

import type { TransactionsSearch } from './searchSchema';

interface TransactionsDateFilterProps {
  search: Pick<TransactionsSearch, 'range' | 'from' | 'to'>;
  onChange: (value: DateRangeValue<RangePreset>) => void;
}

/** The period of the Spending pages, for the page header: all time by default. */
export const TransactionsDateFilter: React.FC<TransactionsDateFilterProps> = ({
  search,
  onChange,
}) => (
  <DateRangeFilter
    presets={RANGE_LABELS}
    allLabel="All time"
    label={
      search.range === 'custom'
        ? formatCustomRange(search.from, search.to)
        : search.range
          ? RANGE_LABELS[search.range]
          : 'All time'
    }
    value={search}
    onChange={onChange}
    maxDay={toDay(new Date())}
  />
);
