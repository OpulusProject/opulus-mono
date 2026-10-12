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
}

// Export singleton instance
export const exchangeRateRepository = new ExchangeRateRepository(prisma);
