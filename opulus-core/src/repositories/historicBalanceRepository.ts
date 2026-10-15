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
   * All of a user's balance history, oldest first. A user has about one row per
   * account per day, so this stays small.
   * @param userId - The user
   * @throws AppError if database error occurs
   */
  async getAllByUserId(userId: string) {
    try {
      const rows = await this.prisma.accountHistoricBalance.findMany({
        where: { userId },
        select: { accountId: true, date: true, balanceCurrent: true },
        orderBy: { date: "asc" },
      });
      return rows.map((row) => ({
        accountId: row.accountId,
        date: row.date.toISOString().slice(0, 10),
        balanceCurrent: row.balanceCurrent.toNumber(),
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get balance history: ${error.message}`
          : "An unexpected error occurred while fetching balance history";
      throw new AppError(message, 500);
    }
  }

  /**
   * Store balance history rows, leaving alone any that are already stored for
   * the same account and day. Rows are never deleted or rewritten, so two syncs
   * that build the same history at the same moment end with one set of rows
   * (the second insert waits for the first and then skips them).
   * @param rows - The history to store
   * @param client - Optional transaction client to run inside a transaction
   * @returns How many rows were newly stored
   * @throws AppError if database error occurs
   */
  async createMissing(
    rows: CreateHistoricBalanceData[],
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      const result = await client.accountHistoricBalance.createMany({
        data: rows,
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
