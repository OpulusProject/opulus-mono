import { getRouteApi } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import type { TransactionFilterParams } from '@/hooks/transactions/transactionParams';
import { resolveRange } from '@/utils/dateRange';

import type { TransactionsSearch } from './searchSchema';

const route = getRouteApi('/_authenticated/transactions');

/**
 * The page's search and filters, read from and written to the URL.
 *
 * `filters` is what to ask the API for; `hasFilters` is whether a filter is
 * set (not counting the search) and `isFiltered` whether the search or a filter
 * is. `clearFilters` clears the filters and `reset` everything.
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
      itemIds: search.institution,
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

  const reset = useCallback(() => {
    void navigate({ search: {}, replace: true });
  }, [navigate]);

  const hasFilters = !!(
    search.range ||
    search.institution?.length ||
    search.category?.length
  );

  /** Clear the date, institution and category filters, but not the search. */
  const clearFilters = useCallback(() => {
    update({
      range: undefined,
      from: undefined,
      to: undefined,
      institution: undefined,
      category: undefined,
    });
  }, [update]);

  return {
    search,
    filters,
    update,
    reset,
    hasFilters,
    clearFilters,
    isFiltered: !!(
      search.q ||
      search.range ||
      search.institution?.length ||
      search.category?.length
    ),
  };
}
