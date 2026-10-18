import { z } from 'zod';

/** Kinds of activity the page filters by. */
export const ACTIVITY_FILTER_KINDS = [
  'buy',
  'sell',
  'dividend',
  'added',
  'fee',
] as const;

export type ActivitySearch = z.infer<typeof activitySearchSchema>;

export type HoldingsSearch = z.infer<typeof holdingsSearchSchema>;

export type OverviewSearch = z.infer<typeof overviewSearchSchema>;

export const activitySearchSchema = z.object({
  account: z.string().optional().catch(undefined),
  kind: z.enum(ACTIVITY_FILTER_KINDS).optional().catch(undefined),
  /** How far back; the last twelve months by default. */
  range: z.enum(['year', 'all']).optional().catch(undefined),
});

export const holdingsSearchSchema = z.object({
  account: z.string().optional().catch(undefined),
  /** The holding whose sheet is open (its id). */
  holding: z.string().optional().catch(undefined),
  /** How holdings are laid out; the list is the default. */
  layout: z.enum(['accounts']).optional().catch(undefined),
  /** Only accounts of this subtype (tfsa, rrsp, ...). */
  type: z.string().optional().catch(undefined),
});

/**
 * Each page's state is kept in the URL so a view survives a refresh and can be
 * shared or linked to (a holding's sheet opens from a link). Every field is
 * optional and left out when not set; a value that does not parse is ignored.
 */
export const overviewSearchSchema = z.object({
  /** Only this account (our account id). */
  account: z.string().optional().catch(undefined),
});
