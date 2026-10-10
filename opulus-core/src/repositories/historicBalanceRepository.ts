import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";

export interface CreateHistoricBalanceData {
  accountId: string;
  userId: string;
  /** The day the balance closed (UTC midnight). */
  date: Date;
  balanceCurrent: number;
  isoCurrencyCode: string | null;
}

class HistoricBalanceRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Whether any of an item's accounts already has balance history
   * @param itemId - The item
   * @throws AppError if database error occurs
   */
  async existsForItem(itemId: string): Promise<boolean> {
    try {
      const count = await this.prisma.accountHistoricBalance.count({
        where: { account: { itemId } },
        take: 1,
      });
      return count > 0;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to check balance history: ${error.message}`
          : "An unexpected error occurred while checking balance history";
      throw new AppError(message, 500);
    }
  }

  /**
   * Replace some accounts' balance history with these rows
   * @param accountIds - The accounts whose existing history is cleared first
   * @param rows - The history to store
   * @param client - Optional transaction client to run inside a transaction
   * @returns How many rows were stored
   * @throws AppError if database error occurs
   */
  async replaceForAccounts(
    accountIds: string[],
    rows: CreateHistoricBalanceData[],
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      await client.accountHistoricBalance.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      const result = await client.accountHistoricBalance.createMany({
        data: rows,
        // Two syncs finishing together may both write the same history.
        skipDuplicates: true,
      });
      return result.count;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to store balance history: ${error.message}`
          : "An unexpected error occurred while storing balance history";
      throw new AppError(message, 500);
    }
  }
}

export const historicBalanceRepository = new HistoricBalanceRepository(prisma);
