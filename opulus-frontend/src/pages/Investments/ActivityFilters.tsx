import { ChevronDown, ListFilter } from 'lucide-react';
import * as React from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';

import { ACTIVITY_FILTER_KINDS, type ActivitySearch } from './searchSchema';

/**
 * How the filters fit the list header, by the header's width in px. Every
 * layout choice is made here so the thresholds are in one place.
 */
const COLLAPSE_BELOW = 400; // the two menus no longer fit side by side
const SHOW_PICKS_FROM = 560; // room for a menu to show what is picked

const ALL_KINDS = 'all';
const DEFAULT_PERIOD = '12m';

const KIND_LABELS = {
  [ALL_KINDS]: 'All',
  buy: 'Buys',
  sell: 'Sells',
  dividend: 'Dividends',
  added: 'Money added',
  fee: 'Fees',
} as const;

const PERIOD_LABELS = {
  [DEFAULT_PERIOD]: 'Last 12 months',
  year: 'This year',
  all: 'All time',
} as const;

type Kind = keyof typeof KIND_LABELS;
type Period = keyof typeof PERIOD_LABELS;

const KINDS: Kind[] = [ALL_KINDS, ...ACTIVITY_FILTER_KINDS];
const PERIODS = Object.keys(PERIOD_LABELS) as Period[];

interface ActivityFiltersProps {
  search: Pick<ActivitySearch, 'kind' | 'range'>;
  /** The width of the list header the filters are in. */
  width: number;
  onChange: (changes: Partial<Pick<ActivitySearch, 'kind' | 'range'>>) => void;
}

/**
 * The filters as borderless menus for the header of the activity list: the kind
 * of transaction and how far back to look. A menu whose filter is set shows its
 * value in bold. Changes apply right away and go into the URL. In a header too
 * narrow for both, one Filters menu holds them.
 */
export const ActivityFilters: React.FC<ActivityFiltersProps> = ({
  search,
  width,
  onChange,
}) => {
  const kind: Kind = search.kind ?? ALL_KINDS;
  const period: Period = search.range ?? DEFAULT_PERIOD;
  const changeKind = (value: string) =>
    onChange({
      kind: value === ALL_KINDS ? undefined : (value as ActivitySearch['kind']),
    });
  const changePeriod = (value: string) =>
    onChange({
      range:
        value === DEFAULT_PERIOD
          ? undefined
          : (value as ActivitySearch['range']),
    });

  if (width < COLLAPSE_BELOW) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Filters"
            className="text-muted-foreground"
          >
            <ListFilter />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel>Kind</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={kind} onValueChange={changeKind}>
            {KINDS.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {KIND_LABELS[value]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Period</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={period} onValueChange={changePeriod}>
            {PERIODS.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {PERIOD_LABELS[value]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const compact = width < SHOW_PICKS_FROM;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <FilterMenu
        label="Kind"
        value={kind}
        valueLabel={KIND_LABELS[kind]}
        isSet={kind !== ALL_KINDS}
        compact={compact}
        options={KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))}
        onChange={changeKind}
      />
      <FilterMenu
        label="Period"
        value={period}
        valueLabel={PERIOD_LABELS[period]}
        isSet={period !== DEFAULT_PERIOD}
        compact={compact}
        options={PERIODS.map((value) => ({
          value,
          label: PERIOD_LABELS[value],
        }))}
        onChange={changePeriod}
      />
    </div>
  );
};

interface FilterMenuProps {
  label: string;
  value: string;
  /** What the filter is set to, in words. */
  valueLabel: string;
  /** Not at its default: the menu shows it in bold. */
  isSet: boolean;
  /** Show a dot rather than what is chosen. */
  compact: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** One header menu: a label with its choice, opening a list of choices. */
const FilterMenu: React.FC<FilterMenuProps> = ({
  label,
  value,
  valueLabel,
  isSet,
  compact,
  options,
  onChange,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'text-muted-foreground',
          compact && 'px-1.5',
          isSet && 'text-foreground'
        )}
      >
        <span className={cn(isSet && 'font-semibold')}>
          {label}
          {!compact && <span>: {valueLabel}</span>}
        </span>
        {isSet && compact && (
          <span
            aria-hidden
            className="bg-primary size-1.5 shrink-0 rounded-full"
          />
        )}
        <ChevronDown />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-44">
      <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
        {options.map((option) => (
          <DropdownMenuRadioItem key={option.value} value={option.value}>
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);
