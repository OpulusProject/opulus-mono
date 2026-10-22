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
  /**
   * The price of one unit, in `currency`, from our own price for the security.
   * Null for a security we do not price (cash, options, bonds, a fund with no
   * symbol), whose value is the institution's.
   */
  price: z.number().nullable(),
  /** When that price is from (the provider's time); null with no price. */
  priceAsOf: IsoTimestampSchema.nullable(),
  /**
   * The price is older than a few days (a long weekend is not). False with no
   * price: nothing says it is old.
   */
  priceStale: z.boolean(),
  /**
   * The whole holding's value: its quantity at our price when we have one,
   * otherwise as the institution reports it.
   */
  value: z.number(),
  currency: z.string().nullable(),
  /** `value` in the base currency, at today's rate. */
  valueInBase: z.number(),
  /** `valueInBase` as a fraction of the summary's value. */
  share: z.number(),
  /** What was paid in total for everything held, when the institution says. */
  costBasis: z.number().nullable(),
  /** `costBasis` for one unit, in `currency`; null without a cost basis or a quantity. */
  averageCost: z.number().nullable(),
  /** `value` minus `costBasis` (negative for a loss); null without a cost basis. */
  gain: z.number().nullable(),
  /** `gain` in the base currency, at today's rate; null without a cost basis. */
  gainInBase: z.number().nullable(),
  /** `gain` as a fraction of `costBasis` (0.25 is +25%); null without a cost basis. */
  gainPercent: z.number().nullable(),
  /**
   * What this holding paid out in the last twelve months (dividends, interest,
   * capital gains), in the base currency.
   */
  dividends: z.number(),
});

export type HoldingDTO = z.infer<typeof HoldingDTOSchema>;

/**
 * One security across the accounts that hold it: what is held in all of them
 * together, in the base currency. The gain is shown only when every holding of
 * it has a cost basis, as a partial one would understate what was paid.
 */
export const PositionDTOSchema = z.object({
  security: HoldingSecurityDTOSchema,
  /** The holdings (one per account) it is made of, largest first. */
  holdingIds: z.array(z.string()),
  /** How many accounts hold it. */
  accountCount: z.number().int(),
  /** The shares (or units, contracts) held, in all the accounts. */
  quantity: z.number(),
  valueInBase: z.number(),
  /** `valueInBase` as a fraction of the summary's value. */
  share: z.number(),
  /** The currency the security is held in, if every holding agrees. */
  currency: z.string().nullable(),
  /**
   * What was paid in all, in `currency`; null unless every holding of it has a
   * cost basis and they share a currency.
   */
  costBasis: z.number().nullable(),
  /** `costBasis` for one unit, in `currency`; null when `costBasis` is, or without a quantity. */
  averageCost: z.number().nullable(),
  /** What the holdings paid out in the last twelve months, in the base currency. */
  dividends: z.number(),
  /** Null unless every holding of it has a cost basis. */
  gainInBase: z.number().nullable(),
  /** `gainInBase` as a fraction of what was paid; null when `gainInBase` is. */
  gainPercent: z.number().nullable(),
  /** Any of the holdings has an old price. */
  priceStale: z.boolean(),
});

export type PositionDTO = z.infer<typeof PositionDTOSchema>;

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
  /** The ids of the holdings that earned the most, by `gainInBase`, largest first. */
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
 * summary in `baseCurrency`. A holding is valued at our own price of its
 * security when we have one (see `priceAsOf`), otherwise as the institution
 * reports it.
 */
export const HoldingsResponseSchema = z.object({
  data: z.object({
    baseCurrency: z.string(),
    summary: HoldingsSummaryDTOSchema,
    /** The user's investment accounts, largest first. */
    accounts: z.array(HoldingsAccountDTOSchema),
    holdings: z.array(HoldingDTOSchema),
    /** The holdings added up by security, largest first. */
    positions: z.array(PositionDTOSchema),
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

/** A security's latest price, as stored. */
export interface SecurityPriceRow {
  price: number;
  /** ISO 4217 code the price is in. */
  currency: string;
  /** When the provider says it is from. */
  asOf: Date;
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
  /**
   * Our latest price of each security, by security id. A holding of a security
   * in it is valued at this price; one that is not is valued as the institution
   * reports it.
   */
  prices?: ReadonlyMap<string, SecurityPriceRow>;
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

/** What was paid for one unit, rounded to Plaid's 4 decimals; null without both. */
const perUnit = (costBasis: number | null, quantity: number) =>
  costBasis === null || quantity <= 0 ? null : round(costBasis / quantity);

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
    prices = new Map(),
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
    // Our price of the security when we have one, in the holding's currency
    // (its own, or the price's when it names none). Otherwise the institution's.
    const ours = prices.get(row.security.id);
    const currency = row.isoCurrencyCode ?? ours?.currency ?? null;
    const rate = rateOn(currency);
    const price =
      ours && ours.currency !== currency
        ? ours.price * (rateOn(ours.currency) / rate)
        : (ours?.price ?? null);
    const quantity = row.quantity.toNumber();
    const rowValue =
      price === null
        ? row.institutionValue.toNumber()
        : round(quantity * price);
    const rowBasis = row.costBasis?.toNumber() ?? null;
    // The cost basis is in the currency Plaid labels the holding with. When our
    // price is in another one we cannot tell which the institution meant (it
    // sometimes labels a US security's holding in dollars it did not use), so
    // a gain would be a guess: there is none.
    const basis = ours && ours.currency !== currency ? null : rowBasis;
    const valueInBase = round(rowValue * rate);
    const kind = holdingKind(row.security.type, row.security.isCashEquivalent);

    const units = toUnits(rowValue * rate);
    value += units;
    add(byKind, kind, units);
    add(byCurrency, currency ?? baseCurrency, units);
    const account = byAccount.get(row.accountId) ?? {
      value: 0,
      costBasis: 0,
      valueWithBasis: 0,
    };
    account.value += units;
    if (basis === null) {
      withoutBasis += 1;
    } else {
      costBasis += toUnits(basis * rate);
      valueWithBasis += units;
      account.costBasis += toUnits(basis * rate);
      account.valueWithBasis += units;
    }
    byAccount.set(row.accountId, account);

    const gain = basis === null ? null : round(rowValue - basis);
    const gainUnits = basis === null ? null : units - toUnits(basis * rate);
    const stale =
      ours !== undefined &&
      now.getTime() - ours.asOf.getTime() > STALE_PRICE_DAYS * DAY_MS;
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
      quantity,
      price: price === null ? null : round(price),
      priceAsOf: ours ? iso(ours.asOf) : null,
      priceStale: stale,
      value: rowValue,
      currency,
      valueInBase,
      units,
      dividends: fromUnits(
        dividendsByHolding.get(`${row.accountId}:${security.id}`) ?? 0
      ),
      costBasis: rowBasis,
      averageCost: perUnit(rowBasis, quantity),
      gain,
      gainUnits,
      basisUnits: basis === null ? null : toUnits(basis * rate),
      gainInBase: gainUnits === null ? null : fromUnits(gainUnits),
      gainPercent:
        basis === null || basis === 0 ? null : (rowValue - basis) / basis,
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

  holdings.sort((a, b) => b.units - a.units || a.id.localeCompare(b.id));
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

  // One position per security, over the accounts that hold it.
  const bySecurity = new Map<string, typeof holdings>();
  for (const holding of holdings) {
    const group = bySecurity.get(holding.security.id) ?? [];
    group.push(holding);
    bySecurity.set(holding.security.id, group);
  }
  const positions = [...bySecurity.values()]
    .map((group) => {
      const units = group.reduce((sum, h) => sum + h.units, 0);
      const complete = group.every((h) => h.gainUnits !== null);
      const sharedCurrency = group.every(
        (h) => h.currency === group[0]!.currency
      )
        ? group[0]!.currency
        : undefined;
      const gainUnits = complete
        ? group.reduce((sum, h) => sum + h.gainUnits!, 0)
        : null;
      const quantity = group.reduce((sum, h) => sum + h.quantity, 0);
      const costBasis =
        complete && sharedCurrency !== undefined
          ? round(group.reduce((sum, h) => sum + h.costBasis!, 0))
          : null;
      const basisUnits = complete
        ? group.reduce((sum, h) => sum + h.basisUnits!, 0)
        : null;
      return {
        units,
        position: {
          security: group[0]!.security,
          holdingIds: group.map((h) => h.id),
          accountCount: new Set(group.map((h) => h.accountId)).size,
          quantity,
          valueInBase: fromUnits(units),
          share: fraction(units, value),
          currency: sharedCurrency ?? null,
          costBasis,
          averageCost: perUnit(costBasis, quantity),
          dividends: round(group.reduce((sum, h) => sum + h.dividends, 0)),
          gainInBase: gainUnits === null ? null : fromUnits(gainUnits),
          gainPercent:
            gainUnits === null || !basisUnits ? null : gainUnits / basisUnits,
          priceStale: group.some((h) => h.priceStale),
        },
      };
    })
    .sort(
      (a, b) =>
        b.units - a.units ||
        a.position.holdingIds[0]!.localeCompare(b.position.holdingIds[0]!)
    )
    .map(({ position }) => position);

  const totalGain = valueWithBasis - costBasis;
  const gainRanking = holdings
    .filter((holding) => holding.gainUnits !== null)
    .sort((a, b) => b.gainUnits! - a.gainUnits! || a.id.localeCompare(b.id))
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
    holdings: holdings.map(
      ({
        units,
        gainUnits: _gainUnits,
        basisUnits: _basisUnits,
        ...holding
      }) => ({
        ...holding,
        share: fraction(units, value),
      })
    ),
    positions,
  };
}
