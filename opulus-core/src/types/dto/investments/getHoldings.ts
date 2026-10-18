/**
 * Get Holdings endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { fromUnits, toUnits } from "../../../utils/money.js";
import { IsoTimestampSchema, toIsoString } from "../common.js";

/**
 * What a holding is, in the terms the page groups by. Derived from Plaid's
 * security type; `balance` is not a security: it stands for an investment
 * account that reports a balance but no holdings.
 */
export const HOLDING_KINDS = [
  "etf",
  "stock",
  "mutualFund",
  "bond",
  "option",
  "cash",
  "other",
] as const;
export const HoldingKindSchema = z.enum(HOLDING_KINDS);
export type HoldingKind = z.infer<typeof HoldingKindSchema>;

export const AllocationKindSchema = z.enum([...HOLDING_KINDS, "balance"]);
export type AllocationKind = z.infer<typeof AllocationKindSchema>;

/** An option contract, when the security is one. */
export const OptionContractDTOSchema = z.object({
  /** "call" or "put". */
  contractType: z.string().nullable(),
  expirationDate: IsoTimestampSchema.nullable(),
  /** Per share, in the security's currency. */
  strikePrice: z.number().nullable(),
  underlyingTicker: z.string().nullable(),
});

/** A bond, when the security is one. */
export const BondDTOSchema = z.object({
  maturityDate: IsoTimestampSchema.nullable(),
  issueDate: IsoTimestampSchema.nullable(),
  /** Paid at maturity, per unit. */
  faceValue: z.number().nullable(),
  /** Percent a year, as the institution reports it; `yieldType` says which kind. */
  yieldRate: z.number().nullable(),
  /** Plaid's kind of yield: "coupon" or "yield_to_maturity". */
  yieldType: z.string().nullable(),
});

export const HoldingSecurityDTOSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  tickerSymbol: z.string().nullable(),
  /** Plaid's type: equity, etf, mutual fund, fixed income, cash, ... */
  type: z.string().nullable(),
  /** `type` in the page's terms. */
  kind: HoldingKindSchema,
  isCashEquivalent: z.boolean(),
  /** The exchange's market identifier code (XTSE, XNAS, ...), if known. */
  exchange: z.string().nullable(),
  option: OptionContractDTOSchema.nullable(),
  bond: BondDTOSchema.nullable(),
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
  /** The account's subtype (tfsa, rrsp, brokerage, ...). */
  accountSubtype: z.string().nullable(),
  /** The last digits of the account number. */
  accountMask: z.string().nullable(),
  institutionName: z.string().nullable(),
  security: HoldingSecurityDTOSchema,
  quantity: z.number(),
  /** The price of one unit, as the institution last quoted it. */
  price: z.number(),
  /** When that price was current (the institution's date), if it said. */
  priceAsOf: IsoTimestampSchema.nullable(),
  /**
   * The price is older than a few days (a long weekend is not). False when the
   * institution gave no date: nothing says it is old, nothing says it is not.
   */
  priceStale: z.boolean(),
  /** The whole holding's value, as the institution reports it. */
  value: z.number(),
  currency: z.string().nullable(),
  /** `value` in the base currency, at today's rate. */
  valueInBase: z.number(),
  /** `valueInBase` as a fraction of the summary's value. */
  share: z.number(),
  /** What was paid in total for everything held, when the institution says. */
  costBasis: z.number().nullable(),
  /** `value` minus `costBasis` (negative for a loss); null without a cost basis. */
  gain: z.number().nullable(),
  /** `gain` as a fraction of `costBasis` (0.25 is +25%); null without a cost basis. */
  gainPercent: z.number().nullable(),
  /**
   * What this holding paid out in the last twelve months (dividends, interest,
   * capital gains), in the base currency.
   */
  dividends: z.number(),
});

export type HoldingDTO = z.infer<typeof HoldingDTOSchema>;

/** One slice of the portfolio, by kind. */
export const AllocationDTOSchema = z.object({
  kind: AllocationKindSchema,
  /** In the base currency. */
  value: z.number(),
  share: z.number(),
});

/** One slice of the portfolio, by the currency it is held in. */
export const CurrencySplitDTOSchema = z.object({
  currency: z.string(),
  /** In the base currency. */
  value: z.number(),
  share: z.number(),
});

/**
 * An investment account and what it is worth: its holdings added up, or, for an
 * account whose institution gives no holdings, its balance (`hasHoldings` is
 * false). In the base currency.
 */
export const HoldingsAccountDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  institutionName: z.string().nullable(),
  subtype: z.string().nullable(),
  mask: z.string().nullable(),
  value: z.number(),
  share: z.number(),
  hasHoldings: z.boolean(),
  /** Over the account's holdings that have a cost basis; null when none do. */
  gain: z.number().nullable(),
  gainPercent: z.number().nullable(),
});

export type HoldingsAccountDTO = z.infer<typeof HoldingsAccountDTOSchema>;

/**
 * What the holdings add up to, in the base currency. The gain counts only the
 * holdings that have a cost basis, so it is never a value minus nothing.
 */
export const HoldingsSummaryDTOSchema = z.object({
  /** Every holding's `valueInBase`, plus the balance of accounts with no holdings. */
  value: z.number(),
  /** How many investment accounts the value spans. */
  accountCount: z.number().int(),
  holdingCount: z.number().int(),
  /** By kind, largest first. */
  allocation: z.array(AllocationDTOSchema),
  /** By currency, largest first. */
  currencies: z.array(CurrencySplitDTOSchema),
  /** The three largest holdings that are not cash, as a fraction of `value`. */
  topHoldingsShare: z.number(),
  /** Dividends, interest and capital gains paid in the last twelve months, in the base currency. */
  dividends: z.number(),
  /** `dividends` as a fraction of `value`. */
  dividendYield: z.number(),
  /** `gain` plus `dividends`. */
  totalReturn: z.number(),
  /** `totalReturn` as a fraction of `costBasis`; null when no holding has a cost basis. */
  totalReturnPercent: z.number().nullable(),
  /** The ids of the holdings that did best, as a fraction of what was paid, best first. */
  gainRanking: z.array(z.string()),
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
    /** The user's investment accounts, largest first. */
    accounts: z.array(HoldingsAccountDTOSchema),
    holdings: z.array(HoldingDTOSchema),
  }),
});

export type HoldingsResponse = z.infer<typeof HoldingsResponseSchema>;

/** A stored holding with the rows the DTO names. */
type HoldingRow = Prisma.HoldingGetPayload<{
  include: {
    security: true;
    account: { select: { name: true; subtype: true; mask: true } };
    item: { select: { institutionName: true } };
  };
}>;

/** An investment account as the DTO needs it. */
export interface HoldingsAccountRow {
  id: string;
  name: string;
  subtype: string | null;
  mask: string | null;
  balanceCurrent: Prisma.Decimal | null;
  isoCurrencyCode: string | null;
  item: { institutionName: string | null };
}

/** A dividend, interest or capital gain payment, as the DTO adds them up. */
export interface DividendRow {
  accountId: string;
  securityId: string | null;
  /** Plaid's sign: money in is negative. */
  amount: Prisma.Decimal;
  isoCurrencyCode: string | null;
}

/** How many holdings the gain ranking names. */
export const GAIN_RANKING_SIZE = 6;

export interface HoldingsOptions {
  baseCurrency: string;
  /** Base-currency units for one unit of `currency` today (see `loadExchangeRateConverter`). */
  rateOn: (currency: string | null) => number;
  /** The user's investment accounts; the ones with no holdings are counted by their balance. */
  accounts?: HoldingsAccountRow[];
  /** The last twelve months' dividend payments of the user, all accounts. */
  dividends?: DividendRow[];
  /** `value` (largest first, the default) or `account` (account by account, then largest first). */
  sort?: "value" | "account";
  /** The current moment, for telling a price is old. */
  now?: Date;
}

/** A price older than this many days is flagged (a long weekend is four). */
export const STALE_PRICE_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A security's kind, from Plaid's type. */
export function holdingKind(
  type: string | null,
  isCashEquivalent: boolean
): HoldingKind {
  if (isCashEquivalent || type === "cash") return "cash";
  switch (type) {
    case "etf":
      return "etf";
    case "equity":
      return "stock";
    case "mutual fund":
      return "mutualFund";
    case "fixed income":
      return "bond";
    case "derivative":
      return "option";
    default:
      return "other";
  }
}

/** A money amount rounded to Plaid's 4 decimals. */
const round = (amount: number) => fromUnits(toUnits(amount));

const iso = (date: Date | null) => (date ? toIsoString(date) : null);

/** Fractions rounded to 6 places, so a share is stable to compare. */
const fraction = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1e6) / 1e6;

/**
 * Transform stored holdings to the API's holdings and summary. Each holding's
 * gain is its value minus its cost basis, in its own currency; the summary
 * converts every holding to the base currency before adding, and counts the
 * gain only over holdings that have a cost basis. An investment account whose
 * institution gives no holdings is counted by its balance.
 */
export function toHoldingsDTO(
  rows: HoldingRow[],
  {
    baseCurrency,
    rateOn,
    accounts = [],
    dividends = [],
    sort = "value",
    now = new Date(),
  }: HoldingsOptions
): HoldingsResponse["data"] {
  let value = 0;
  let costBasis = 0;
  let valueWithBasis = 0;
  let withoutBasis = 0;

  const byKind = new Map<AllocationKind, number>();
  const byCurrency = new Map<string, number>();
  const byAccount = new Map<
    string,
    { value: number; costBasis: number; valueWithBasis: number }
  >();
  const add = <K>(map: Map<K, number>, key: K, units: number) =>
    map.set(key, (map.get(key) ?? 0) + units);

  // Dividends of the accounts in view, in total and per holding.
  const accountsInView = new Set([
    ...rows.map((row) => row.accountId),
    ...accounts.map((account) => account.id),
  ]);
  let dividendUnits = 0;
  const dividendsByHolding = new Map<string, number>();
  for (const payment of dividends) {
    if (!accountsInView.has(payment.accountId)) continue;
    const units = toUnits(
      -payment.amount.toNumber() * rateOn(payment.isoCurrencyCode)
    );
    dividendUnits += units;
    if (payment.securityId) {
      add(
        dividendsByHolding,
        `${payment.accountId}:${payment.securityId}`,
        units
      );
    }
  }

  const holdings = rows.map((row) => {
    const rate = rateOn(row.isoCurrencyCode);
    const rowValue = row.institutionValue.toNumber();
    const rowBasis = row.costBasis?.toNumber() ?? null;
    const valueInBase = round(rowValue * rate);
    const kind = holdingKind(row.security.type, row.security.isCashEquivalent);

    const units = toUnits(rowValue * rate);
    value += units;
    add(byKind, kind, units);
    add(byCurrency, row.isoCurrencyCode ?? baseCurrency, units);
    const account = byAccount.get(row.accountId) ?? {
      value: 0,
      costBasis: 0,
      valueWithBasis: 0,
    };
    account.value += units;
    if (rowBasis === null) {
      withoutBasis += 1;
    } else {
      costBasis += toUnits(rowBasis * rate);
      valueWithBasis += units;
      account.costBasis += toUnits(rowBasis * rate);
      account.valueWithBasis += units;
    }
    byAccount.set(row.accountId, account);

    const gain = rowBasis === null ? null : round(rowValue - rowBasis);
    const stale =
      row.institutionPriceAsOf !== null &&
      now.getTime() - row.institutionPriceAsOf.getTime() >
        STALE_PRICE_DAYS * DAY_MS;
    const { security } = row;
    return {
      id: row.id,
      accountId: row.accountId,
      accountName: row.account.name,
      accountSubtype: row.account.subtype,
      accountMask: row.account.mask,
      institutionName: row.item.institutionName,
      security: {
        id: security.id,
        name: security.name,
        tickerSymbol: security.tickerSymbol,
        type: security.type,
        kind,
        isCashEquivalent: security.isCashEquivalent,
        exchange: security.marketIdentifierCode,
        option: security.optionContractType
          ? {
              contractType: security.optionContractType,
              expirationDate: iso(security.optionExpirationDate),
              strikePrice: security.optionStrikePrice?.toNumber() ?? null,
              underlyingTicker: security.optionUnderlyingTicker,
            }
          : null,
        bond:
          kind === "bond"
            ? {
                maturityDate: iso(security.bondMaturityDate),
                issueDate: iso(security.bondIssueDate),
                faceValue: security.bondFaceValue?.toNumber() ?? null,
                yieldRate: security.bondYieldRate?.toNumber() ?? null,
                yieldType: security.bondYieldType,
              }
            : null,
      },
      quantity: row.quantity.toNumber(),
      price: row.institutionPrice.toNumber(),
      priceAsOf: iso(row.institutionPriceAsOf),
      priceStale: stale,
      value: rowValue,
      currency: row.isoCurrencyCode,
      valueInBase,
      units,
      dividends: fromUnits(
        dividendsByHolding.get(`${row.accountId}:${security.id}`) ?? 0
      ),
      costBasis: rowBasis,
      gain,
      gainPercent:
        rowBasis === null || rowBasis === 0
          ? null
          : (rowValue - rowBasis) / rowBasis,
    };
  });

  // Accounts that report a balance but no holdings count by that balance.
  const accountsWithHoldings = new Set(rows.map((row) => row.accountId));
  const balanceOnly = accounts.filter(
    (account) =>
      !accountsWithHoldings.has(account.id) && account.balanceCurrent !== null
  );
  for (const account of balanceOnly) {
    const units = toUnits(
      account.balanceCurrent!.toNumber() * rateOn(account.isoCurrencyCode)
    );
    value += units;
    add(byKind, "balance", units);
    add(byCurrency, account.isoCurrencyCode ?? baseCurrency, units);
    byAccount.set(account.id, {
      value: units,
      costBasis: 0,
      valueWithBasis: 0,
    });
  }

  const accountOrder = new Map(
    accounts
      .map((account) => ({
        id: account.id,
        units: byAccount.get(account.id)?.value ?? 0,
      }))
      .sort((a, b) => b.units - a.units || a.id.localeCompare(b.id))
      .map((account, index) => [account.id, index])
  );
  holdings.sort(
    (a, b) =>
      (sort === "account"
        ? (accountOrder.get(a.accountId) ?? 0) -
          (accountOrder.get(b.accountId) ?? 0)
        : 0) ||
      b.units - a.units ||
      a.id.localeCompare(b.id)
  );
  const top3 = holdings
    .filter((h) => h.security.kind !== "cash")
    .slice(0, 3)
    .reduce((sum, h) => sum + h.units, 0);

  const accountRows = accounts
    .filter((account) => byAccount.has(account.id))
    .map((account) => {
      const totals = byAccount.get(account.id)!;
      const hasHoldings = accountsWithHoldings.has(account.id);
      const gain = totals.valueWithBasis - totals.costBasis;
      const hasBasis = hasHoldings && totals.costBasis !== 0;
      return {
        id: account.id,
        name: account.name,
        institutionName: account.item.institutionName,
        subtype: account.subtype,
        mask: account.mask,
        value: fromUnits(totals.value),
        share: fraction(totals.value, value),
        hasHoldings,
        gain: hasBasis ? fromUnits(gain) : null,
        gainPercent: hasBasis ? gain / totals.costBasis : null,
        units: totals.value,
      };
    })
    .sort((a, b) => b.units - a.units || a.id.localeCompare(b.id));

  const slices = <K>(map: Map<K, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]);

  const totalGain = valueWithBasis - costBasis;
  const gainRanking = holdings
    .filter((holding) => holding.gainPercent !== null)
    .sort((a, b) => b.gainPercent! - a.gainPercent! || a.id.localeCompare(b.id))
    .slice(0, GAIN_RANKING_SIZE)
    .map((holding) => holding.id);
  return {
    baseCurrency,
    summary: {
      value: fromUnits(value),
      accountCount: accountRows.length,
      holdingCount: holdings.length,
      allocation: slices(byKind).map(([kind, units]) => ({
        kind,
        value: fromUnits(units),
        share: fraction(units, value),
      })),
      currencies: slices(byCurrency).map(([currency, units]) => ({
        currency,
        value: fromUnits(units),
        share: fraction(units, value),
      })),
      topHoldingsShare: fraction(top3, value),
      dividends: fromUnits(dividendUnits),
      dividendYield: fraction(dividendUnits, value),
      totalReturn: fromUnits(totalGain + dividendUnits),
      totalReturnPercent:
        costBasis === 0 ? null : (totalGain + dividendUnits) / costBasis,
      gainRanking,
      costBasis: fromUnits(costBasis),
      gain: fromUnits(totalGain),
      gainPercent: costBasis === 0 ? null : totalGain / costBasis,
      holdingsWithoutCostBasis: withoutBasis,
    },
    accounts: accountRows.map(({ units: _units, ...account }) => account),
    holdings: holdings.map(({ units, ...holding }) => ({
      ...holding,
      share: fraction(units, value),
    })),
  };
}
