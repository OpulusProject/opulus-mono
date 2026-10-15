/**
 * Plaid's amounts have at most 4 decimals, so money is added up in whole units
 * of 1/10,000 to avoid float drift, and turned back into an amount at the end.
 */
export const SCALE = 10_000;

/** An amount in whole units, rounded to the nearest. */
export const toUnits = (amount: number) => Math.round(amount * SCALE);

/** Whole units back to an amount. */
export const fromUnits = (units: number) => units / SCALE;
