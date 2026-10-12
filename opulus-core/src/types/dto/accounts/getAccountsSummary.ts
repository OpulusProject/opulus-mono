/**
 * Get Accounts Summary endpoint DTOs
 */

import { z } from "zod";

import { AccountTypeSchema } from "./accountType.js";

/**
 * What the matching accounts add up to, in the base currency. Balances in
 * another currency are converted at the latest stored rate, so one figure
 * covers every account.
 */
export const AccountsTotalDTOSchema = z.object({
  /** Balances as the accounts report them, owed ones counted as positive. */
  balance: z.number(),
  /** Balances of the accounts that are owned (everything but credit and loans). */
  assets: z.number(),
  /** Balances of credit and loan accounts, as a positive number. */
  owed: z.number(),
  /** assets minus owed. */
  netWorth: z.number(),
});

export type AccountsTotalDTO = z.infer<typeof AccountsTotalDTOSchema>;

/** Credit cards with a known limit: that limit and how much of it is used. */
export const AccountsCreditDTOSchema = z.object({
  /** The limits of the credit accounts that have one, added up. */
  limit: z.number(),
  /** What is owed on those accounts as a fraction (0 to 1+) of `limit`. */
  utilization: z.number(),
});

export type AccountsCreditDTO = z.infer<typeof AccountsCreditDTOSchema>;

export const AccountsTypeDTOSchema = z.object({
  /** The normalized type (see `AccountType`). */
  type: AccountTypeSchema,
  /** How many accounts of this type, including any left out of `balance`. */
  count: z.number().int(),
  /** Their balances as reported (owed ones positive), in the base currency. */
  balance: z.number(),
  /** Only for credit accounts, and only when some account has a known limit. */
  credit: AccountsCreditDTOSchema.nullable(),
});

export type AccountsTypeDTO = z.infer<typeof AccountsTypeDTOSchema>;

/** Accounts in a currency with no stored rate: they cannot be converted. */
export const AccountsExcludedDTOSchema = z.object({
  /** ISO 4217 code. */
  currency: z.string(),
  count: z.number().int(),
});

export type AccountsExcludedDTO = z.infer<typeof AccountsExcludedDTOSchema>;

/**
 * Accounts summary API response, for the same `type` filter as the list. Every
 * amount is in `baseCurrency`. An account in a currency with no stored rate is
 * left out of every amount (it is still counted in `count`) and listed in
 * `excluded`, so a client can say the total does not include it.
 */
export const AccountsSummaryResponseSchema = z.object({
  data: z.object({
    /** The currency every amount is in. */
    baseCurrency: z.string(),
    /** How many accounts match. */
    count: z.number().int(),
    total: AccountsTotalDTOSchema,
    /** Only the types that have accounts, in the order of `ACCOUNT_TYPES`. */
    byType: z.array(AccountsTypeDTOSchema),
    excluded: z.array(AccountsExcludedDTOSchema),
  }),
});

export type AccountsSummaryResponse = z.infer<
  typeof AccountsSummaryResponseSchema
>;
