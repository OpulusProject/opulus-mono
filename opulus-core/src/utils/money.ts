/**
 * Plaid's amounts have at most 4 decimals. Money is rounded to that, in one of
 * two ways, depending on what is being added up:
 *
 * - **Whole units** (`toUnits` / `fromUnits`) for plain numbers, as in the
 *   services that add up accounts. Each amount becomes an integer count of
 *   1/10,000, so sums do not drift, and the total is turned back at the end.
 * - **Decimals** (`toAmount`) for what the database sums and for products with
 *   an exchange rate. Prisma returns those as `Decimal`, which is exact to add
 *   but not to multiply by a rate (a quotient), so the result is rounded once.
 *   Only the DTO mappers hold Decimals: services may not import Prisma.
 */
const DECIMALS = 4;

export const SCALE = 10 ** DECIMALS;

/** An amount in whole units, rounded to the nearest. */
export const toUnits = (amount: number) => Math.round(amount * SCALE);

/** Whole units back to an amount. */
export const fromUnits = (units: number) => units / SCALE;

/** A `Decimal` (Prisma's) as a number, rounded to Plaid's decimals. */
export const toAmount = (amount: {
  toDecimalPlaces(decimals: number): { toNumber(): number };
}) => amount.toDecimalPlaces(DECIMALS).toNumber();
