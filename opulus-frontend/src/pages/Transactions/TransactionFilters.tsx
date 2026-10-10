import { ChevronDown, ChevronRight, ListFilter } from 'lucide-react';
import React from 'react';

import {
  type MenuOption,
  MultiSelectItems,
  MultiSelectMenu,
} from '@/common/MultiSelectMenu';
import {
  Button,
  Calendar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Popover,
  PopoverAnchor,
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
  const institutions: MenuOption[] = (data?.items ?? []).map((item) => ({
    value: item.id,
    label: item.institutionName ?? 'Unknown institution',
    logoUrl: getInstitutionLogo(item),
  }));
  const categories: MenuOption[] = CATEGORY_OPTIONS.map((category) => ({
    value: category,
    label: getCategoryLabel(category),
    icon: getCategoryIcon(category),
  }));

  const changeInstitutions = (change: (selected: string[]) => string[]): void =>
    onChange((previous) => ({
      institution: change(previous.institution ?? []),
    }));
  const changeCategories = (change: (selected: string[]) => string[]): void =>
    onChange((previous) => ({
      category: change(
        previous.category ?? []
      ) as TransactionsSearch['category'],
    }));

  return (
    <>
      {/* Side by side when the header is wide enough, otherwise in one menu. */}
      <div className="hidden flex-wrap items-center gap-1 @2xl:flex">
        <DateMenu search={search} onChange={onChange} />
        <MultiSelectMenu
          label="Institution"
          options={institutions}
          selected={search.institution ?? []}
          onChange={changeInstitutions}
        />
        <MultiSelectMenu
          label="Category"
          options={categories}
          selected={search.category ?? []}
          onChange={changeCategories}
        />
      </div>

      <div className="@2xl:hidden">
        <CollapsedFilters
          search={search}
          onChange={onChange}
          institutions={institutions}
          categories={categories}
          onChangeInstitutions={changeInstitutions}
          onChangeCategories={changeCategories}
        />
      </div>
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

/** What the date filter is set to, or nothing for "any time". */
function dateValue(search: TransactionsSearch): string | undefined {
  const custom = search.range === 'custom';
  if (custom && search.from && search.to) {
    return search.from === search.to
      ? formatRangeDay(search.from)
      : `${formatRangeDay(search.from)} – ${formatRangeDay(search.to)}`;
  }
  if (custom && search.from) return `From ${formatRangeDay(search.from)}`;
  if (custom) return 'Custom range';
  if (search.range && search.range !== 'custom') {
    return RANGE_LABELS[search.range];
  }
  return undefined;
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
  const value = dateValue(search);

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
        <DatePanel
          search={search}
          onChange={onChange}
          onPreset={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
};

interface DatePanelProps {
  search: TransactionsSearch;
  onChange: TransactionFiltersProps['onChange'];
  /** Called after a preset is chosen, e.g. to close the popover. */
  onPreset?: () => void;
  /** Always put the presets above the calendar, in a fixed narrow width. */
  stacked?: boolean;
}

/** The presets beside a range calendar. */
const DatePanel: React.FC<DatePanelProps> = ({
  search,
  onChange,
  onPreset,
  stacked,
}) => {
  const choose = (range: RangePreset | undefined) => {
    onChange({ range, from: undefined, to: undefined });
    onPreset?.();
  };

  return (
    <div className={cn('flex flex-col', stacked ? 'w-72' : 'sm:flex-row')}>
      <div
        role="radiogroup"
        aria-label="Date range"
        className={cn(
          'flex flex-wrap gap-1 border-b p-2',
          !stacked &&
            'sm:w-40 sm:shrink-0 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0'
        )}
      >
        <PresetItem selected={!search.range} onClick={() => choose(undefined)}>
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
  );
};

interface CollapsedFiltersProps {
  search: TransactionsSearch;
  onChange: TransactionFiltersProps['onChange'];
  institutions: MenuOption[];
  categories: MenuOption[];
  onChangeInstitutions: (change: (selected: string[]) => string[]) => void;
  onChangeCategories: (change: (selected: string[]) => string[]) => void;
}

/**
 * All the filters behind one button, for a header too narrow for the menus
 * side by side: it lists the filters, and each opens its own choices.
 */
const CollapsedFilters: React.FC<CollapsedFiltersProps> = ({
  search,
  onChange,
  institutions,
  categories,
  onChangeInstitutions,
  onChangeCategories,
}) => {
  const date = dateValue(search);
  const institutionCount = search.institution?.length ?? 0;
  const categoryCount = search.category?.length ?? 0;

  const [dateOpen, setDateOpen] = React.useState(false);
  // Set when Date is picked: once the menu has closed, the date popover opens
  // in its place instead of the focus going back to the button.
  const openingDate = React.useRef(false);

  return (
    // A date range does not fit in a side submenu on a phone, so Date opens a
    // popover under the button instead.
    <Popover open={dateOpen} onOpenChange={setDateOpen}>
      <PopoverAnchor asChild>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                <ListFilter />
                Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-48"
              onCloseAutoFocus={(event) => {
                if (openingDate.current) {
                  event.preventDefault();
                  openingDate.current = false;
                  // After the menu's own focus handling is done.
                  setTimeout(() => setDateOpen(true), 50);
                }
              }}
            >
              <DropdownMenuLabel>Filter by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  openingDate.current = true;
                }}
              >
                <FilterLabel label="Date" value={date} />
                <ChevronRight className="text-muted-foreground size-4" />
              </DropdownMenuItem>
              <FilterSubmenu
                label="Institution"
                value={
                  institutionCount ? `${institutionCount} selected` : undefined
                }
              >
                <DropdownMenuSubContent className="max-h-80 min-w-56 overflow-y-auto">
                  <MultiSelectItems
                    options={institutions}
                    selected={search.institution ?? []}
                    onChange={onChangeInstitutions}
                  />
                </DropdownMenuSubContent>
              </FilterSubmenu>
              <FilterSubmenu
                label="Category"
                value={categoryCount ? `${categoryCount} selected` : undefined}
              >
                <DropdownMenuSubContent className="max-h-80 min-w-56 overflow-y-auto">
                  <MultiSelectItems
                    options={categories}
                    selected={search.category ?? []}
                    onChange={onChangeCategories}
                  />
                </DropdownMenuSubContent>
              </FilterSubmenu>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-max max-w-[var(--radix-popover-content-available-width)] p-0"
      >
        <DatePanel
          search={search}
          onChange={onChange}
          onPreset={() => setDateOpen(false)}
          stacked
        />
      </PopoverContent>
    </Popover>
  );
};

interface FilterSubmenuProps {
  label: string;
  /** What the filter is set to, shown after the label. */
  value?: string;
  children: React.ReactNode;
}

/** One filter in the collapsed menu; `children` is its `DropdownMenuSubContent`. */
const FilterSubmenu: React.FC<FilterSubmenuProps> = ({
  label,
  value,
  children,
}) => (
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>
      <FilterLabel label={label} value={value} />
    </DropdownMenuSubTrigger>
    {children}
  </DropdownMenuSub>
);

/** A row of the collapsed menu: the filter's name and what it is set to. */
const FilterLabel: React.FC<{ label: string; value?: string }> = ({
  label,
  value,
}) => (
  <>
    <span className={cn('flex-1', value && 'font-semibold')}>{label}</span>
    {value && (
      <span className="text-muted-foreground pl-4 text-xs">{value}</span>
    )}
  </>
);

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
