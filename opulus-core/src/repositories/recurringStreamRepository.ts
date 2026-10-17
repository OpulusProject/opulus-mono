import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";

/**
 * Repository for recurring streams
 * Plaid's current view of an item's recurring payments and income
 */
class RecurringStreamRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * A user's recurring streams, with their account name and the institution's
   * name. Only the user's own, whatever the filters.
   * @param userId - The user
   * @param filters - Only this direction; and active streams only unless
   *   `includeInactive`
   * @throws AppError if database error occurs
   */
  async getAllByUserId(
    userId: string,
    filters: {
      direction?: "inflow" | "outflow";
      includeInactive?: boolean;
    } = {}
  ) {
    try {
      return await this.prisma.recurringStream.findMany({
        where: {
          userId,
          direction: filters.direction,
          isActive: filters.includeInactive ? undefined : true,
        },
        include: {
          account: { select: { name: true } },
          item: { select: { institutionName: true } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get recurring transactions: ${error.message}`
          : "An unexpected error occurred while fetching recurring transactions";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const recurringStreamRepository = new RecurringStreamRepository(prisma);
