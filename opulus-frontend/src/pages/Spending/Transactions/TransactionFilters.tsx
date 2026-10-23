import { MultiSelectMenu } from '@/common/MultiSelectMenu';
import { getCategoryIcon, getCategoryLabel } from '@/utils/transactionCategory';

import { CATEGORY_OPTIONS, type TransactionsSearch } from './searchSchema';

/** Below this header width (px) the menu shows a dot rather than the picks. */
const COMPACT_BELOW = 896;

const categories = CATEGORY_OPTIONS.map((category) => ({
  value: category,
  label: getCategoryLabel(category),
  icon: getCategoryIcon(category),
}));

interface TransactionFiltersProps {
  search: TransactionsSearch;
  /** The width of the list header the filter is in. */
  width: number;
  onChange: (
    changes:
      | Partial<TransactionsSearch>
      | ((previous: TransactionsSearch) => Partial<TransactionsSearch>)
  ) => void;
}

/**
 * The category filter as a borderless menu for the header of the transactions
 * list. It shows its value in bold when set. Changes apply right away and go
 * into the URL. The period and accounts are filtered in the page header.
 */
export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  search,
  width,
  onChange,
}) => (
  <MultiSelectMenu
    label="Category"
    options={categories}
    selected={search.category ?? []}
    onChange={(change) =>
      onChange((previous) => ({
        category: change(
          previous.category ?? []
        ) as TransactionsSearch['category'],
      }))
    }
    compact={width < COMPACT_BELOW}
  />
);
