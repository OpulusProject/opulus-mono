import { z } from 'zod';

/**
 * The page's search, kept in the URL so it survives a refresh and can be
 * shared. A value that does not parse is ignored rather than breaking the page.
 */
export const transactionsSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
});
