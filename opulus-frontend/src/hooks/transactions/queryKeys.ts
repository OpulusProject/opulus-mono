/**
 * Query keys for transactions. `all` is the prefix, used to invalidate every
 * transactions query; `list` is one list for a set of filters and pagination.
 */
export const transactionKeys = {
  all: ['transactions'] as const,
  list: (params?: object) => [...transactionKeys.all, params] as const,
};
