import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';

import { ACTIVITY_FILTER_KINDS, type ActivitySearch } from './searchSchema';

const ALL_KINDS = 'all';

const KIND_LABELS = {
  [ALL_KINDS]: 'All',
  buy: 'Buys',
  sell: 'Sells',
  dividend: 'Dividends',
  added: 'Money added',
  fee: 'Fees',
} as const;

type Kind = keyof typeof KIND_LABELS;

const KINDS: Kind[] = [ALL_KINDS, ...ACTIVITY_FILTER_KINDS];

interface ActivityFiltersProps {
  kind: ActivitySearch['kind'];
  onChange: (changes: Pick<ActivitySearch, 'kind'>) => void;
}

/**
 * The kind of transaction as a borderless menu for the header of the activity
 * list, as on Transactions: it shows its choice, in bold when it is not "All".
 * The period and accounts are filtered in the page header, as on the other
 * Investments pages.
 */
export const ActivityFilters: React.FC<ActivityFiltersProps> = ({
  kind,
  onChange,
}) => {
  const value: Kind = kind ?? ALL_KINDS;
  const isSet = value !== ALL_KINDS;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('text-muted-foreground', isSet && 'text-foreground')}
        >
          <span className={cn(isSet && 'font-semibold')}>
            Kind: {KIND_LABELS[value]}
          </span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) =>
            onChange({
              kind:
                next === ALL_KINDS
                  ? undefined
                  : (next as Kind as ActivitySearch['kind']),
            })
          }
        >
          {KINDS.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {KIND_LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
