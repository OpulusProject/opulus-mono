import { getRouteApi } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import type { TransactionFilterParams } from '@/hooks/transactions/transactionParams';
import { resolveRange } from '@/utils/dateRange';

import type { TransactionsSearch } from './searchSchema';

const route = getRouteApi('/_authenticated/spending/transactions');

/**
 * The page's search and filters, read from and written to the URL.
 *
 * `filters` is what to ask the API for; `hasFilters` is whether a filter is
 * set (not counting the search) and `isFiltered` whether the search or a filter
 * is. `clearFilters` clears the list's filters, but not the search or the
 * period and accounts in the page header.
 */
export function useTransactionFilters() {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const filters = useMemo<TransactionFilterParams>(() => {
    const days =
      search.range === 'custom'
        ? { start: search.from, end: search.to }
        : search.range
          ? resolveRange(search.range)
          : undefined;
    return {
      search: search.q,
      startDate: days?.start,
      endDate: days?.end,
      accountIds: search.account,
      categories: search.category,
    };
  }, [search]);

  /**
   * Change some of the filters. An empty value removes it from the URL. Pass a
   * function to work from the filters as they are now, so two quick changes
   * (ticking two categories) don't overwrite each other.
   */
  const update = useCallback(
    (
      changes:
        | Partial<TransactionsSearch>
        | ((previous: TransactionsSearch) => Partial<TransactionsSearch>)
    ) => {
      void navigate({
        search: (previous) =>
          Object.fromEntries(
            Object.entries({
              ...previous,
              ...(typeof changes === 'function' ? changes(previous) : changes),
            }).filter(
              ([, value]) =>
                value !== undefined &&
                value !== '' &&
                !(Array.isArray(value) && value.length === 0)
            )
          ),
        replace: true,
      });
    },
    [navigate]
  );

  // The period and accounts are filtered in the page header, which has its own
  // way to clear them; what is cleared here is what the list header filters.
  const hasFilters = !!search.category?.length;

  /** Clear the category filter, but not the search or the page's filters. */
  const clearFilters = useCallback(() => {
    update({ category: undefined });
  }, [update]);

  return {
    search,
    filters,
    update,
    hasFilters,
    clearFilters,
    isFiltered: !!(
      search.q ||
      search.range ||
      search.account?.length ||
      search.category?.length
    ),
  };
}
