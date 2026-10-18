/**
 * Investment activity endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { fromUnits, toUnits } from "../../../utils/money.js";
import {
  IsoTimestampSchema,
  PaginationMetadataSchema,
  toIsoString,
} from "../common.js";

/**
 * What an investment transaction was, in the terms the page filters by.
 * `other` is everything else (transfers of securities, splits, tax, ...).
 */
export const ACTIVITY_KINDS = [
  "buy",
  "sell",
  "dividend",
  "added",
  "removed",
  "fee",
  "other",
] as const;
export const ActivityKindSchema = z.enum(ACTIVITY_KINDS);
export type ActivityKind = z.infer<typeof ActivityKindSchema>;

/** Cash subtypes (Plaid's) that are income from holding something. */
export const DIVIDEND_SUBTYPES = [
  "dividend",
  "qualified dividend",
  "non-qualified dividend",
  "interest",
  "long-term capital gain",
  "short-term capital gain",
];
/** Cash subtypes that are money put into the account. */
export const ADDED_SUBTYPES = ["deposit", "contribution"];
/** Cash subtypes that are money taken out of the account. */
export const REMOVED_SUBTYPES = ["withdrawal", "distribution"];

/** The kind of an investment transaction, from Plaid's type and subtype. */
export function activityKind(
  type: string,
  subtype: string | null
): ActivityKind {
  if (type === "buy") return "buy";
  if (type === "sell") return "sell";
  if (type === "fee") return "fee";
  if (type === "cash" && subtype) {
    if (DIVIDEND_SUBTYPES.includes(subtype)) return "dividend";
    if (ADDED_SUBTYPES.includes(subtype)) return "added";
    if (REMOVED_SUBTYPES.includes(subtype)) return "removed";
  }
  return "other";
}

export const ActivityItemDTOSchema = z.object({
  id: z.string(),
  date: IsoTimestampSchema,
  kind: ActivityKindSchema,
  /** The institution's description. */
  description: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  accountSubtype: z.string().nullable(),
  accountMask: z.string().nullable(),
  institutionName: z.string().nullable(),
  /** What was bought, sold or paid on; null for cash movements and fees. */
  security: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      tickerSymbol: z.string().nullable(),
    })
    .nullable(),
  quantity: z.number().nullable(),
  /** Price of one unit, when there is a security. */
  price: z.number().nullable(),
  /**
   * The effect on the account's cash, in `currency`: positive when money came
   * in (a sale, a dividend, money added), negative when it went out (a buy, a
   * fee). Plaid's own sign is the opposite.
   */
  amount: z.number(),
  /** A fee charged on a buy or sell, on top of `amount`, positive. */
  fees: z.number().nullable(),
  currency: z.string().nullable(),
  /** `amount` in the base currency, at today's rate. */
  amountInBase: z.number(),
});

export type ActivityItemDTO = z.infer<typeof ActivityItemDTOSchema>;

/**
 * Activity API response: a page of the user's investment transactions, newest
 * first. Moves between the user's own accounts appear once, here, as money
 * added.
 */
export const ActivityResponseSchema = z.object({
  data: z.object({
    baseCurrency: z.string(),
    items: z.array(ActivityItemDTOSchema),
    pagination: PaginationMetadataSchema,
  }),
});

export type ActivityResponse = z.infer<typeof ActivityResponseSchema>;

/**
 * What came in and went out over the last twelve months and this calendar
 * year, in the base currency (today's rates). All amounts are positive.
 */
export const ActivitySummaryResponseSchema = z.object({
  data: z.object({
    baseCurrency: z.string(),
    /** The first day of the twelve months (inclusive). */
    since: z.string(),
    /** Dividends, interest and capital gains paid out, last twelve months. */
    dividends: z.number(),
    /** Fee transactions plus fees charged on trades, last twelve months. */
    fees: z.number(),
    /** Money put into the accounts, last twelve months. */
    added: z.number(),
    /** Money taken out of the accounts, last twelve months. */
    removed: z.number(),
    /** The calendar year (UTC) that `addedThisYear` covers. */
    year: z.number().int(),
    /** Money put into the accounts so far this calendar year. */
    addedThisYear: z.number(),
  }),
});

export type ActivitySummaryResponse = z.infer<
  typeof ActivitySummaryResponseSchema
>;

/** A stored investment transaction with the rows the DTO names. */
export type ActivityRow = Prisma.InvestmentTransactionGetPayload<{
  include: {
    security: { select: { id: true; name: true; tickerSymbol: true } };
    account: { select: { name: true; subtype: true; mask: true } };
    item: { select: { institutionName: true } };
  };
}>;

/** A money amount rounded to Plaid's 4 decimals. */
const round = (amount: number) => fromUnits(toUnits(amount));

/** Transform stored investment transactions to the API's activity items. */
export function toActivityItemsDTO(
  rows: ActivityRow[],
  rateOn: (currency: string | null) => number
): ActivityItemDTO[] {
  return rows.map((row) => {
    // Plaid counts money leaving the account as positive; the page reads the
    // other way round.
    const amount = round(-row.amount.toNumber());
    return {
      id: row.id,
      date: toIsoString(row.date),
      kind: activityKind(row.type, row.subtype),
      description: row.name,
      accountId: row.accountId,
      accountName: row.account.name,
      accountSubtype: row.account.subtype,
      accountMask: row.account.mask,
      institutionName: row.item.institutionName,
      security: row.security
        ? {
            id: row.security.id,
            name: row.security.name,
            tickerSymbol: row.security.tickerSymbol,
          }
        : null,
      quantity: row.quantity?.toNumber() ?? null,
      price: row.price?.toNumber() ?? null,
      amount,
      fees: row.fees?.toNumber() ?? null,
      currency: row.isoCurrencyCode,
      amountInBase: round(amount * rateOn(row.isoCurrencyCode)),
    };
  });
}
