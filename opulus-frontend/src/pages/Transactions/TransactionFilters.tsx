import { ChevronDown } from 'lucide-react';
import React from 'react';

import { MultiSelectMenu } from '@/common/MultiSelectMenu';
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import { cn } from '@/lib/utils';
import {
  RANGE_LABELS,
  type RangePreset,
  fromDay,
  toDay,
} from '@/utils/dateRange';
import { formatDay } from '@/utils/day';
import { getInstitutionLogo } from '@/utils/institution';
import { getCategoryIcon, getCategoryLabel } from '@/utils/transactionCategory';

import { CATEGORY_OPTIONS, type TransactionsSearch } from './searchSchema';

interface TransactionFiltersProps {
  search: TransactionsSearch;
  onChange: (
    changes:
      | Partial<TransactionsSearch>
      | ((previous: TransactionsSearch) => Partial<TransactionsSearch>)
  ) => void;
}

/**
 * The filters as borderless menus for the header of the transactions list: the
 * date range, the institutions and the categories. A menu whose filter is set
 * shows its value in bold. Changes apply right away and go into the URL.
 */
export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  search,
  onChange,
}) => {
  const { data } = useItems();
  const institutions = (data?.items ?? []).map((item) => ({
    value: item.id,
    label: item.institutionName ?? 'Unknown institution',
    logoUrl: getInstitutionLogo(item),
  }));

  return (
    <>
      <DateMenu search={search} onChange={onChange} />

      <MultiSelectMenu
        label="Institution"
        options={institutions}
        selected={search.institution ?? []}
        onChange={(change) =>
          onChange((previous) => ({
            institution: change(previous.institution ?? []),
          }))
        }
      />

      <MultiSelectMenu
        label="Category"
        options={CATEGORY_OPTIONS.map((category) => ({
          value: category,
          label: getCategoryLabel(category),
          icon: getCategoryIcon(category),
        }))}
        selected={search.category ?? []}
        onChange={(change) =>
          onChange((previous) => ({
            category: change(
              previous.category ?? []
            ) as TransactionsSearch['category'],
          }))
        }
      />
    </>
  );
};

const SHORT_DAY = { month: 'short', day: 'numeric' } as const;

/** "Oct 1", or "Oct 1, 2025" for a day that is not in the current year. */
function formatRangeDay(day: string): string {
  const thisYear = new Date().getFullYear();
  return formatDay(
    day,
    fromDay(day).getFullYear() === thisYear
      ? SHORT_DAY
      : { ...SHORT_DAY, year: 'numeric' }
  );
}

interface DateMenuProps {
  search: TransactionsSearch;
  onChange: TransactionFiltersProps['onChange'];
}

/**
 * A header menu for how far back to look. It opens a popover with the presets
 * beside a range calendar: a preset applies and closes the popover; picking
 * days on the calendar is a custom range.
 */
const DateMenu: React.FC<DateMenuProps> = ({ search, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const custom = search.range === 'custom';

  // What is chosen, when it is not "any time".
  let value: string | undefined;
  if (custom && search.from && search.to) {
    value =
      search.from === search.to
        ? formatRangeDay(search.from)
        : `${formatRangeDay(search.from)} – ${formatRangeDay(search.to)}`;
  } else if (custom && search.from) {
    value = `From ${formatRangeDay(search.from)}`;
  } else if (custom) {
    value = 'Custom range';
  } else if (search.range && search.range !== 'custom') {
    value = RANGE_LABELS[search.range];
  }

  const choose = (range: RangePreset | undefined) => {
    onChange({ range, from: undefined, to: undefined });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'text-muted-foreground px-1.5 @4xl:px-3',
            value && 'text-foreground'
          )}
        >
          <span className={cn(value && 'font-semibold')}>
            Date
            {value && <span className="hidden @4xl:inline">: {value}</span>}
          </span>
          {value && (
            <span
              aria-hidden
              className="bg-primary size-1.5 shrink-0 rounded-full @4xl:hidden"
            />
          )}
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-max max-w-[var(--radix-popover-content-available-width)] p-0"
      >
        <div className="flex flex-col sm:flex-row">
          <div
            role="radiogroup"
            aria-label="Date range"
            className="flex flex-wrap gap-1 border-b p-2 sm:w-40 sm:shrink-0 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0"
          >
            <PresetItem
              selected={!search.range}
              onClick={() => choose(undefined)}
            >
              Any time
            </PresetItem>
            {(Object.keys(RANGE_LABELS) as RangePreset[]).map((preset) => (
              <PresetItem
                key={preset}
                selected={search.range === preset}
                onClick={() => choose(preset)}
              >
                {RANGE_LABELS[preset]}
              </PresetItem>
            ))}
          </div>
          <Calendar
            mode="range"
            numberOfMonths={1}
            defaultMonth={search.from ? fromDay(search.from) : undefined}
            selected={{
              from: search.from ? fromDay(search.from) : undefined,
              to: search.to ? fromDay(search.to) : undefined,
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
      </PopoverContent>
    </Popover>
  );
};

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
