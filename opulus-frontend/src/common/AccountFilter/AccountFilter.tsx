import { ChevronDown, ListFilter } from 'lucide-react';
import * as React from 'react';

import { type MenuOption, MultiSelectItems } from '@/common/MultiSelectMenu';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';

interface AccountFilterProps {
  /** The accounts to choose from: all of them, not just those in view. */
  accounts: { id: string; name: string }[];
  /** The accounts the page is limited to (our account ids); none is all of them. */
  selected: string[];
  onChange: (selected: string[]) => void;
}

/**
 * A menu for limiting a page to some of the user's accounts, each listed by its
 * name: a dashed button with a filter icon, saying "All accounts", one
 * account's name, or how many; it opens a list of checkboxes. Not shown with
 * fewer than two accounts, as there is nothing to choose.
 */
export const AccountFilter: React.FC<AccountFilterProps> = ({
  accounts,
  selected,
  onChange,
}) => {
  if (accounts.length < 2) return null;

  const options: MenuOption[] = accounts.map((account) => ({
    value: account.id,
    label: account.name,
  }));
  const label =
    selected.length === 0
      ? 'All accounts'
      : selected.length === 1
        ? (accounts.find((account) => account.id === selected[0])?.name ??
          '1 account')
        : `${selected.length} accounts`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed font-normal"
          aria-label={`Accounts: ${label}`}
        >
          <ListFilter />
          {label}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 min-w-48 overflow-y-auto"
      >
        <DropdownMenuLabel>Filter by account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={selected.length === 0}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() => onChange([])}
        >
          All accounts
        </DropdownMenuCheckboxItem>
        <MultiSelectItems
          options={options}
          selected={selected}
          onChange={(change) => onChange(change(selected))}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
