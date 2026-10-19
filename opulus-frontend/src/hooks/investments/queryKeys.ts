/**
 * Query keys for investments. `all` is the prefix, used to invalidate every
 * investments query; `holdings` is what the user holds, optionally filtered.
 */
export const investmentKeys = {
  all: ['investments'] as const,
  holdings: (params?: object) =>
    [...investmentKeys.all, 'holdings', params ?? 'all'] as const,
};
