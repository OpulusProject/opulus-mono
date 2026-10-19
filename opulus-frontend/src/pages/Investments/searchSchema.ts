import { z } from 'zod';

export type OverviewSearch = z.infer<typeof overviewSearchSchema>;

/**
 * The overview's state, kept in the URL so a view survives a refresh and can be
 * shared or linked to (a holding's sheet opens from a link). Every field is
 * optional and left out when not set; a value that does not parse is ignored.
 */
export const overviewSearchSchema = z.object({
  /** Only this account (our account id). */
  account: z.string().optional().catch(undefined),
  /** The holding whose sheet is open (its id). */
  holding: z.string().optional().catch(undefined),
});
