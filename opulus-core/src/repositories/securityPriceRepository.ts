import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";
import type { SymbolInput } from "../utils/securitySymbol.js";

/** A security's latest stored price. */
export interface LatestPrice {
  price: number;
  /** ISO 4217 code the price is in. */
  currency: string;
  /** When the provider says it is from. */
  asOf: Date;
}

/** A security as pricing sees it: ours, and what its provider symbol is worked out from. */
export interface PricedSecurity extends SymbolInput {
  id: string;
}

/** One day's close to store. */
export interface StoredClose {
  /** "YYYY-MM-DD". */
  date: string;
  close: number;
}

function wrap(error: unknown, what: string): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new AppError(`Database error: ${error.message}`, 500, error.code);
  }
  return new AppError(
    error instanceof Error
      ? `Failed to ${what}: ${error.message}`
      : `An unexpected error occurred while trying to ${what}`,
    500
  );
}

const forPricing = {
  id: true,
  tickerSymbol: true,
  marketIdentifierCode: true,
  type: true,
  isCashEquivalent: true,
} as const;

/**
 * Repository for security prices: written by the scheduler's jobs, read by the
 * holdings API, and for finding the securities to price. Every security is priced, held or not, so there is
 * nothing to track. Shared by every user: nothing here is per user.
 */
class SecurityPriceRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Every security, in the order they were first stored (ids are time-ordered),
   * or only those with no stored price, or those whose history has not been
   * fetched yet.
   * @throws AppError if database error occurs
   */
  async getForPricing(
    options: { withoutPrice?: boolean; withoutHistory?: boolean } = {}
  ): Promise<PricedSecurity[]> {
    try {
      return await this.prisma.security.findMany({
        where: {
          ...(options.withoutPrice && { prices: { none: {} } }),
          ...(options.withoutHistory && { priceBackfilledAt: null }),
        },
        select: forPricing,
        orderBy: { id: "asc" },
      });
    } catch (error) {
      throw wrap(error, "get the securities to price");
    }
  }

  /**
   * The latest stored price of each of these securities, by security id. A
   * security with no stored price is absent.
   * @param securityIds - Our security ids
   * @throws AppError if database error occurs
   */
  async getLatest(securityIds: string[]): Promise<Map<string, LatestPrice>> {
    if (securityIds.length === 0) return new Map();
    try {
      const rows = await this.prisma.securityPrice.findMany({
        where: { securityId: { in: securityIds } },
        distinct: ["securityId"],
        orderBy: [{ securityId: "asc" }, { date: "desc" }],
        select: { securityId: true, close: true, currency: true, asOf: true },
      });
      return new Map(
        rows.map((row) => [
          row.securityId,
          {
            price: row.close.toNumber(),
            currency: row.currency,
            asOf: row.asOf,
          },
        ])
      );
    } catch (error) {
      throw wrap(error, "get security prices");
    }
  }

  /**
   * Each security's last stored price on or before a day: what it was worth then.
   * A security with no price that early is absent.
   * @param securityIds - Our security ids
   * @param day - "YYYY-MM-DD"
   * @throws AppError if database error occurs
   */
  async getOn(
    securityIds: string[],
    day: string
  ): Promise<Map<string, LatestPrice>> {
    if (securityIds.length === 0) return new Map();
    try {
      const rows = await this.prisma.securityPrice.findMany({
        where: {
          securityId: { in: securityIds },
          date: { lte: new Date(`${day}T00:00:00Z`) },
        },
        distinct: ["securityId"],
        orderBy: [{ securityId: "asc" }, { date: "desc" }],
        select: { securityId: true, close: true, currency: true, asOf: true },
      });
      return new Map(
        rows.map((row) => [
          row.securityId,
          {
            price: row.close.toNumber(),
            currency: row.currency,
            asOf: row.asOf,
          },
        ])
      );
    } catch (error) {
      throw wrap(error, "get security prices");
    }
  }

  /**
   * Store a security's latest quote as the price of its trading day, replacing
   * the earlier quote of the day.
   * @param source - The provider the quote is from
   * @throws AppError if database error occurs
   */
  async recordQuote(
    source: string,
    quote: {
      securityId: string;
      day: string;
      price: number;
      currency: string;
      asOf: Date;
    }
  ): Promise<void> {
    const { securityId, day, price, currency, asOf } = quote;
    const date = new Date(`${day}T00:00:00Z`);
    try {
      await this.prisma.securityPrice.upsert({
        where: { securityId_date: { securityId, date } },
        create: { securityId, date, close: price, currency, source, asOf },
        update: { close: price, currency, source, asOf },
      });
    } catch (error) {
      throw wrap(error, "store a quote");
    }
  }

  /**
   * Store a security's history: each day's close, leaving days already stored
   * as they are (a day's own quote is not overwritten by an older close), and
   * record that the history was fetched.
   * @param source - The provider the closes are from
   * @throws AppError if database error occurs
   */
  async recordBackfill(
    source: string,
    backfill: { securityId: string; currency: string; closes: StoredClose[] }
  ): Promise<void> {
    const { securityId, currency, closes } = backfill;
    try {
      await this.prisma.$transaction([
        this.prisma.securityPrice.createMany({
          data: closes.map(({ date, close }) => ({
            securityId,
            date: new Date(`${date}T00:00:00Z`),
            close,
            currency,
            source,
            asOf: new Date(`${date}T00:00:00Z`),
          })),
          skipDuplicates: true,
        }),
        this.prisma.security.update({
          where: { id: securityId },
          data: { priceBackfilledAt: new Date() },
        }),
      ]);
    } catch (error) {
      throw wrap(error, "store a backfill");
    }
  }

  /**
   * Record that a security's history was looked for and the provider has none,
   * so it is not asked for again (clear `priceBackfilledAt` to ask again).
   * @throws AppError if database error occurs
   */
  async markBackfilled(securityId: string): Promise<void> {
    try {
      await this.prisma.security.update({
        where: { id: securityId },
        data: { priceBackfilledAt: new Date() },
      });
    } catch (error) {
      throw wrap(error, "record a backfill");
    }
  }
}

// Export singleton instance
export const securityPriceRepository = new SecurityPriceRepository(prisma);
