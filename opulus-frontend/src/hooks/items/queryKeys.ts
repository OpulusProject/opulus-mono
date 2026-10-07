/**
 * Query keys for items. `all` is the prefix, used to invalidate every items query.
 */
export const itemKeys = {
  all: ['items'] as const,
  list: () => [...itemKeys.all] as const,
};
