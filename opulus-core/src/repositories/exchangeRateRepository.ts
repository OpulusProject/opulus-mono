import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";

export interface CreateExchangeRateData {
  /** The day the rate was published (UTC midnight). */
  date: Date;
  /** ISO 4217 code. */
  currency: string;
  /** Units of `currency` for one euro. */
  perEur: number;
  /** Where the rate came from, e.g. "frankfurter". */
  source: string;
}

/** A stored rate, as read back for a conversion. */
export interface StoredExchangeRate {
  /** "YYYY-MM-DD". */
  date: string;
  currency: string;
  /** Units of `currency` for one euro. */
  perEur: Prisma.Decimal;
}

const toStored = (row: {
  date: Date;
  currency: string;
  perEur: Prisma.Decimal;
}): StoredExchangeRate => ({
  date: row.date.toISOString().slice(0, 10),
  currency: row.currency,
  perEur: row.perEur,
});

function readError(error: unknown): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new AppError(`Database error: ${error.message}`, 500, error.code);
  }
  return new AppError(
    error instanceof Error
      ? `Failed to read exchange rates: ${error.message}`
      : "An unexpected error occurred while reading exchange rates",
    500
  );
}

/** Rows per insert, well under Postgres' limit on parameters in one query. */
const CHUNK = 5000;

class ExchangeRateRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Store rates, skipping any currency and day already stored. A published rate
   * does not change, so a day that is already there is left as it is; that
   * makes it safe to store an overlapping range again.
   * @param rows - The rates to store
   * @returns How many rows were new
   * @throws AppError if database error occurs
   */
  async createMany(rows: CreateExchangeRateData[]): Promise<number> {
    try {
      let created = 0;
      for (let start = 0; start < rows.length; start += CHUNK) {
        const result = await this.prisma.exchangeRate.createMany({
          data: rows.slice(start, start + CHUNK),
          skipDuplicates: true,
        });
        created += result.count;
      }
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to store exchange rates: ${error.message}`
          : "An unexpected error occurred while storing exchange rates";
      throw new AppError(message, 500);
    }
  }

  /**
   * The most recent day with a stored rate, as "YYYY-MM-DD", or null when the
   * table is empty
   * @throws AppError if database error occurs
   */
  async getLatestDate(): Promise<string | null> {
    try {
      const result = await this.prisma.exchangeRate.aggregate({
        _max: { date: true },
      });
      return result._max.date?.toISOString().slice(0, 10) ?? null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to read exchange rates: ${error.message}`
          : "An unexpected error occurred while reading exchange rates";
      throw new AppError(message, 500);
    }
  }

  /**
   * The stored rates of some currencies from a little before `from` to `to`, so
   * every day in the range has the latest rate on or before it (weekends and
   * holidays have none; two weeks covers the longest gap). Oldest first.
   * @param params.currencies - ISO 4217 codes
   * @param params.from - "YYYY-MM-DD"
   * @param params.to - "YYYY-MM-DD"
   * @throws AppError if database error occurs
   */
  async getForCurrencies(params: {
    currencies: string[];
    from: string;
    to: string;
  }): Promise<StoredExchangeRate[]> {
    try {
      const from = new Date(`${params.from}T00:00:00Z`);
      from.setUTCDate(from.getUTCDate() - 14);
      const rows = await this.prisma.exchangeRate.findMany({
        where: {
          currency: { in: params.currencies },
          date: { gte: from, lte: new Date(`${params.to}T00:00:00Z`) },
        },
        select: { date: true, currency: true, perEur: true },
        orderBy: { date: "asc" },
      });
      return rows.map(toStored);
    } catch (error) {
      throw readError(error);
    }
  }

  /**
   * Each currency's earliest stored rate, for an amount older than the stored
   * history.
   * @param currencies - ISO 4217 codes
   * @throws AppError if database error occurs
   */
  async getEarliestForCurrencies(
    currencies: string[]
  ): Promise<StoredExchangeRate[]> {
    try {
      const rows = await this.prisma.exchangeRate.findMany({
        where: { currency: { in: currencies } },
        select: { date: true, currency: true, perEur: true },
        orderBy: [{ currency: "asc" }, { date: "asc" }],
        distinct: ["currency"],
      });
      return rows.map(toStored);
    } catch (error) {
      throw readError(error);
    }
  }
}

// Export singleton instance
export const exchangeRateRepository = new ExchangeRateRepository(prisma);
