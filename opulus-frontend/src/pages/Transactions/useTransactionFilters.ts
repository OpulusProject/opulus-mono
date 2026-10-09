import { getRouteApi } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import type { TransactionFilterParams } from '@/hooks/transactions/transactionParams';

const route = getRouteApi('/_authenticated/transactions');

/**
 * The page's search, read from and written to the URL.
 *
 * `filters` is what to ask the API for (the list and its day totals), `query`
 * is what the search field shows.
 */
export function useTransactionFilters() {
  const { q } = route.useSearch();
  const navigate = route.useNavigate();

  const filters = useMemo<TransactionFilterParams>(() => ({ search: q }), [q]);

  /** Set the search. An empty one is left out of the URL. */
  const setQuery = useCallback(
    (value: string) => {
      void navigate({
        search: value ? { q: value } : {},
        replace: true,
      });
    },
    [navigate]
  );

  return { query: q ?? '', filters, setQuery };
}
