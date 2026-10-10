import { TRANSACTION_CATEGORIES } from '@opulus/core/dto';
import { z } from 'zod';

/** The categories to pick from, in alphabetical order with Uncategorized last. */
export const CATEGORY_OPTIONS = [
  ...[...TRANSACTION_CATEGORIES].sort(),
  'UNCATEGORIZED',
] as const;

export type TransactionsSearch = z.infer<typeof transactionsSearchSchema>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * The page's search and filters, kept in the URL so a view survives a refresh
 * and can be shared or linked to. Every field is optional and left out when it
 * is not set; a value that does not parse is ignored rather than breaking the
 * page.
 */
export const transactionsSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  /** How far back to look; none means all time. */
  range: z
    .enum(['today', '7d', '30d', 'year', 'custom'])
    .optional()
    .catch(undefined),
  /** The first and last day of a custom range. */
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
  /** Institutions (our item ids). */
  institution: z.array(z.string()).optional().catch(undefined),
  category: z
    .array(z.enum([...TRANSACTION_CATEGORIES, 'UNCATEGORIZED']))
    .optional()
    .catch(undefined),
});
