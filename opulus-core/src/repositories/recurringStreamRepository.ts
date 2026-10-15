import { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionStream } from "plaid";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";

/** A stream ready to store, keyed by Plaid's account id. */
export interface NormalizedStream {
  providerAccountId: string;
  plaidStreamId: string;
  data: {
    direction: "inflow" | "outflow";
    description: string;
    merchantName: string | null;
    frequency: string;
    status: string;
    isActive: boolean;
    firstDate: Date;
    lastDate: Date;
    predictedNextDate: Date | null;
    averageAmount: number;
    lastAmount: number;
    isoCurrencyCode: string | null;
    category: string | null;
  };
}

/**
 * Normalize Plaid's streams. Plaid reports an outflow's amount as positive and
 * an inflow's as negative, as it does for transactions; the direction is its own
 * column here, so the amounts are stored positive either way.
 */
export function normalizePlaidStreams(response: {
  inflow_streams: TransactionStream[];
  outflow_streams: TransactionStream[];
}): NormalizedStream[] {
  const normalize =
    (direction: "inflow" | "outflow") =>
    (stream: TransactionStream): NormalizedStream => ({
      providerAccountId: stream.account_id,
      plaidStreamId: stream.stream_id,
      data: {
        direction,
        description: stream.description,
        merchantName: stream.merchant_name ?? null,
        frequency: stream.frequency,
        status: stream.status,
        isActive: stream.is_active,
        firstDate: new Date(stream.first_date),
        lastDate: new Date(stream.last_date),
        predictedNextDate: stream.predicted_next_date
          ? new Date(stream.predicted_next_date)
          : null,
        averageAmount: Math.abs(stream.average_amount.amount ?? 0),
        lastAmount: Math.abs(stream.last_amount.amount ?? 0),
        isoCurrencyCode: stream.average_amount.iso_currency_code ?? null,
        category: stream.personal_finance_category?.primary ?? null,
      },
    });

  return [
    ...response.inflow_streams.map(normalize("inflow")),
    ...response.outflow_streams.map(normalize("outflow")),
  ];
}

/**
 * Repository for recurring streams
 * Plaid's current view of an item's recurring payments, replaced on each sync
 */
class RecurringStreamRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Store an item's streams from a sync: upsert each, and delete the item's
   * streams Plaid no longer reports, in one transaction.
   * @param item - The item (and user) the streams belong to
   * @param streams - Each stream, with our account id
   * @throws AppError if database error occurs
   */
  async replaceForItem(
    item: { id: string; userId: string },
    streams: Array<
      Omit<NormalizedStream, "providerAccountId"> & { accountId: string }
    >
  ): Promise<void> {
    const syncedAt = new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const { accountId, plaidStreamId, data } of streams) {
          await tx.recurringStream.upsert({
            where: {
              itemId_plaidStreamId: { itemId: item.id, plaidStreamId },
            },
            create: {
              ...data,
              plaidStreamId,
              accountId,
              itemId: item.id,
              userId: item.userId,
              syncedAt,
            },
            update: { ...data, accountId, syncedAt },
          });
        }

        await tx.recurringStream.deleteMany({
          where: {
            itemId: item.id,
            plaidStreamId: { notIn: streams.map((s) => s.plaidStreamId) },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to store recurring transactions: ${error.message}`
          : "An unexpected error occurred while storing recurring transactions";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const recurringStreamRepository = new RecurringStreamRepository(prisma);
