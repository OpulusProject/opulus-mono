import type { AccountType } from '@opulus/core';

/**
 * Query keys for accounts. `all` is the prefix, used to invalidate every
 * accounts query; `list` is one list, optionally limited to some types.
 */
export const accountKeys = {
  all: ['accounts'] as const,
  list: (types?: AccountType[]) =>
    [...accountKeys.all, types ?? 'all'] as const,
};
