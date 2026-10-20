import { z } from 'zod';

export type HoldingsSearch = z.infer<typeof holdingsSearchSchema>;
export type OverviewSearch = z.infer<typeof overviewSearchSchema>;

/**
 * The Holdings page's state, kept in the URL: the overview's, plus how the
 * holdings are laid out and which type of account they are limited to.
 */
export const holdingsSearchSchema = z.object({
  /** Only these accounts (our account ids); none is all of them. */
  account: z.array(z.string()).optional().catch(undefined),
  /** The holding whose sheet is open (its id). */
  holding: z.string().optional().catch(undefined),
  /** How holdings are laid out; the list is the default. */
  layout: z.enum(['accounts']).optional().catch(undefined),
  /** Only accounts of this subtype (tfsa, rrsp, ...). */
  type: z.string().optional().catch(undefined),
});

/**
 * The page's state, kept in the URL so a view survives a refresh and can be
 * shared or linked to. Every field is optional and left out when not set; a
 * value that does not parse is ignored.
 */
export const overviewSearchSchema = z.object({
  /** Only these accounts (our account ids); none is all of them. */
  account: z.array(z.string()).optional().catch(undefined),
  /** The holding whose sheet is open (its id). */
  holding: z.string().optional().catch(undefined),
});
