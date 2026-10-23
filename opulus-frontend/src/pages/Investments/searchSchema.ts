import { HOLDINGS_RANGES, type HoldingsRange } from '@opulus/core/dto';
import { z } from 'zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The filters the Investments pages share. */
const filterFields = {
  /** Only these accounts (our account ids); none is all of them. */
  account: z.array(z.string()).optional().catch(undefined),
  /** The period the gains are over; all time (since purchase) when not set. */
  range: z.enum(HOLDINGS_RANGES).optional().catch(undefined),
  /** The first and last day of a custom range. */
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
};

/** Kinds of activity the page filters by. */
export const ACTIVITY_FILTER_KINDS = [
  'buy',
  'sell',
  'dividend',
  'added',
  'fee',
] as const;

export type ActivitySearch = z.infer<typeof activitySearchSchema>;

/** The period the gains are over, as the holdings API takes it. */
export interface HoldingsPeriod {
  range?: HoldingsRange;
  from?: string;
  to?: string;
}

export type OverviewSearch = z.infer<typeof overviewSearchSchema>;

/** The activity page's state: the shared filters, and a kind. */
export const activitySearchSchema = z.object({
  ...filterFields,
  kind: z.enum(ACTIVITY_FILTER_KINDS).optional().catch(undefined),
});

/**
 * The period the gains are over, from the page's search, in the terms the API
 * takes: no range is all time, and a custom range with no first day is none.
 */
export function holdingsPeriod(
  search: Pick<OverviewSearch, 'range' | 'from' | 'to'>
): HoldingsPeriod {
  if (search.range === 'custom') {
    return search.from
      ? { range: 'custom', from: search.from, to: search.to }
      : {};
  }
  return search.range && search.range !== 'all' ? { range: search.range } : {};
}

/**
 * The page's state, kept in the URL so a view survives a refresh and can be
 * shared or linked to. Every field is optional and left out when not set; a
 * value that does not parse is ignored.
 */
export const overviewSearchSchema = z.object({
  ...filterFields,
  /** The holding whose sheet is open (its id). */
  holding: z.string().optional().catch(undefined),
});
