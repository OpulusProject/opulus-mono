/**
 * Get Holdings endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { fromUnits, toUnits } from "../../../utils/money.js";
import { IsoTimestampSchema, toIsoString } from "../common.js";

export const HoldingSecurityDTOSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  tickerSymbol: z.string().nullable(),
  /** Plaid's type: equity, etf, mutual fund, fixed income, cash, ... */
  type: z.string().nullable(),
  isCashEquivalent: z.boolean(),
});

export type HoldingSecurityDTO = z.infer<typeof HoldingSecurityDTOSchema>;

/**
 * What one account holds of one security. Amounts are in the holding's own
 * currency (`currency`) except `valueInBase`, which is in the base currency.
 */
export const HoldingDTOSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  institutionName: z.string().nullable(),
  security: HoldingSecurityDTOSchema,
  quantity: z.number(),
  /** The price of one unit, as the institution last quoted it. */
  price: z.number(),
  /** When that price was current (the institution's date), if it said. */
  priceAsOf: IsoTimestampSchema.nullable(),
  /** The whole holding's value, as the institution reports it. */
  value: z.number(),
  currency: z.string().nullable(),
  /** `value` in the base currency, at today's rate. */
  valueInBase: z.number(),
  /** What was paid in total for everything held, when the institution says. */
  costBasis: z.number().nullable(),
  /** `value` minus `costBasis` (negative for a loss); null without a cost basis. */
  gain: z.number().nullable(),
  /** `gain` as a fraction of `costBasis` (0.25 is +25%); null without a cost basis. */
  gainPercent: z.number().nullable(),
});

export type HoldingDTO = z.infer<typeof HoldingDTOSchema>;

/**
 * What the holdings add up to, in the base currency. The gain counts only the
 * holdings that have a cost basis, so it is never a value minus nothing.
 */
export const HoldingsSummaryDTOSchema = z.object({
  /** Every holding's `valueInBase`. */
  value: z.number(),
  /** The cost basis of the holdings that have one, in the base currency. */
  costBasis: z.number(),
  /** Their value minus that cost basis. */
  gain: z.number(),
  /** `gain` as a fraction of `costBasis`; null when no holding has a cost basis. */
  gainPercent: z.number().nullable(),
  /** How many holdings are left out of `costBasis` and `gain`. */
  holdingsWithoutCostBasis: z.number().int(),
});

export type HoldingsSummaryDTO = z.infer<typeof HoldingsSummaryDTOSchema>;

/**
 * Holdings API response: the user's investment holdings, largest first, with a
 * summary in `baseCurrency`. The prices are as fresh as Plaid's last pull from
 * the institution (usually about daily): see `priceAsOf`.
 */
export const HoldingsResponseSchema = z.object({
  data: z.object({
    baseCurrency: z.string(),
    summary: HoldingsSummaryDTOSchema,
    holdings: z.array(HoldingDTOSchema),
  }),
});

export type HoldingsResponse = z.infer<typeof HoldingsResponseSchema>;

/** A stored holding with the rows the DTO names. */
type HoldingRow = Prisma.HoldingGetPayload<{
  include: {
    security: true;
    account: { select: { name: true } };
    item: { select: { institutionName: true } };
  };
}>;

export interface HoldingsOptions {
  baseCurrency: string;
  /** Base-currency units for one unit of `currency` today (see `loadExchangeRateConverter`). */
  rateOn: (currency: string | null) => number;
}

/** A money amount rounded to Plaid's 4 decimals. */
const round = (amount: number) => fromUnits(toUnits(amount));

/**
 * Transform stored holdings to the API's holdings and summary. Each holding's
 * gain is its value minus its cost basis, in its own currency; the summary
 * converts every holding to the base currency before adding, and counts the
 * gain only over holdings that have a cost basis.
 */
export function toHoldingsDTO(
  rows: HoldingRow[],
  { baseCurrency, rateOn }: HoldingsOptions
): HoldingsResponse["data"] {
  let value = 0;
  let costBasis = 0;
  let valueWithBasis = 0;
  let withoutBasis = 0;

  const holdings = rows.map((row) => {
    const rate = rateOn(row.isoCurrencyCode);
    const rowValue = row.institutionValue.toNumber();
    const rowBasis = row.costBasis?.toNumber() ?? null;
    const valueInBase = round(rowValue * rate);

    value += toUnits(rowValue * rate);
    if (rowBasis === null) {
      withoutBasis += 1;
    } else {
      costBasis += toUnits(rowBasis * rate);
      valueWithBasis += toUnits(rowValue * rate);
    }

    const gain = rowBasis === null ? null : round(rowValue - rowBasis);
    return {
      id: row.id,
      accountId: row.accountId,
      accountName: row.account.name,
      institutionName: row.item.institutionName,
      security: {
        id: row.security.id,
        name: row.security.name,
        tickerSymbol: row.security.tickerSymbol,
        type: row.security.type,
        isCashEquivalent: row.security.isCashEquivalent,
      },
      quantity: row.quantity.toNumber(),
      price: row.institutionPrice.toNumber(),
      priceAsOf: row.institutionPriceAsOf
        ? toIsoString(row.institutionPriceAsOf)
        : null,
      value: rowValue,
      currency: row.isoCurrencyCode,
      valueInBase,
      costBasis: rowBasis,
      gain,
      gainPercent:
        rowBasis === null || rowBasis === 0
          ? null
          : (rowValue - rowBasis) / rowBasis,
    };
  });

  holdings.sort(
    (a, b) => b.valueInBase - a.valueInBase || a.id.localeCompare(b.id)
  );

  const gain = valueWithBasis - costBasis;
  return {
    baseCurrency,
    summary: {
      value: fromUnits(value),
      costBasis: fromUnits(costBasis),
      gain: fromUnits(gain),
      gainPercent: costBasis === 0 ? null : gain / costBasis,
      holdingsWithoutCostBasis: withoutBasis,
    },
    holdings,
  };
}
