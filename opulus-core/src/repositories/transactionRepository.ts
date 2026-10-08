import { Prisma, PrismaClient } from "@prisma/client";
import type { Transaction as PlaidTransaction } from "plaid";
import prisma from "../client/prisma.js";
import { AppError, ConflictError, NotFoundError } from "../utils/errors.js";

export interface CreateTransactionData {
  providerTransactionId: string;
  accountId: string;
  itemId: string;
  userId: string;
  amount: number;
  date: Date;
  authorizedDate?: Date | null;
  name: string;
  merchantName?: string | null;
  categoryPrimary?: string | null;
  categoryDetailed?: string | null;
  paymentChannel?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  location?: Prisma.InputJsonObject | null;
  paymentMeta?: Prisma.InputJsonObject | null;
  isoCurrencyCode?: string | null;
  unofficialCurrencyCode?: string | null;
  pending: boolean;
  pendingTransactionId?: string | null;
  accountOwner?: string | null;
  transactionCode?: string | null;
  merchantEntityId?: string | null;
  checkNumber?: string | null;
}

export interface UpdateTransactionData extends Partial<CreateTransactionData> {
  providerTransactionId: string;
  accountId: string;
}

/**
 * Plaid sends `location` and `payment_meta` as objects whose fields are all
 * null when there is nothing to say (an online purchase has no location). Keep
 * only objects with something in them, so a missing value is a null column.
 */
function nonEmptyObject<T extends object>(
  value: T | null | undefined
): Prisma.InputJsonObject | null {
  if (!value || Object.values(value).every((field) => field == null)) {
    return null;
  }
  return { ...value } as Prisma.InputJsonObject;
}

/**
 * A JSON column's value for Prisma: an explicit SQL NULL for null, the value
 * itself otherwise, and nothing for undefined (leave the column alone).
 */
function jsonColumn(value: Prisma.InputJsonObject | null | undefined) {
  return value === null ? Prisma.DbNull : value;
}

/**
 * The columns of a transaction row for Prisma, with the JSON columns converted.
 */
function toColumns<T extends Partial<CreateTransactionData>>(data: T) {
  return {
    ...data,
    location: jsonColumn(data.location),
    paymentMeta: jsonColumn(data.paymentMeta),
  };
}

/**
 * Normalize Plaid Transaction to CreateTransactionData format
 * Handles field name mapping and type conversions
 */
export function normalizePlaidTransaction(
  plaidTransaction: PlaidTransaction,
  accountId: string,
  itemId: string,
  userId: string
): CreateTransactionData {
  return {
    providerTransactionId: plaidTransaction.transaction_id,
    accountId,
    itemId,
    userId,
    amount: plaidTransaction.amount ?? 0,
    date: new Date(plaidTransaction.date),
    authorizedDate: plaidTransaction.authorized_date
      ? new Date(plaidTransaction.authorized_date)
      : null,
    name: plaidTransaction.name,
    merchantName: plaidTransaction.merchant_name ?? null,
    categoryPrimary:
      plaidTransaction.personal_finance_category?.primary ?? null,
    categoryDetailed:
      plaidTransaction.personal_finance_category?.detailed ?? null,
    paymentChannel: plaidTransaction.payment_channel ?? null,
    logoUrl: plaidTransaction.logo_url ?? null,
    website: plaidTransaction.website ?? null,
    location: nonEmptyObject(plaidTransaction.location),
    paymentMeta: nonEmptyObject(plaidTransaction.payment_meta),
    isoCurrencyCode: plaidTransaction.iso_currency_code ?? null,
    unofficialCurrencyCode: plaidTransaction.unofficial_currency_code ?? null,
    pending: plaidTransaction.pending ?? false,
    pendingTransactionId: plaidTransaction.pending_transaction_id ?? null,
    accountOwner: plaidTransaction.account_owner ?? null,
    transactionCode: plaidTransaction.transaction_code ?? null,
    merchantEntityId: plaidTransaction.merchant_entity_id ?? null,
    checkNumber: plaidTransaction.check_number ?? null,
  };
}

/**
 * Repository for Plaid transactions
 * Handles transaction creation, updates, and deletion
 */
class TransactionRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a transaction in the database
   * @param data - Transaction data
   * @returns Created transaction
   * @throws ConflictError if transaction already exists
   * @throws AppError if database error occurs
   */
  async create(
    data: CreateTransactionData,
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      return await client.transaction.create({ data: toColumns(data) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new ConflictError("Transaction already exists");
        }
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to create transaction: ${error.message}`
          : "An unexpected error occurred while creating transaction";
      throw new AppError(message, 500);
    }
  }

  /**
   * Create multiple transactions in a single operation
   * @param dataArray - Array of transaction data
   * @param client - Optional transaction client to run inside a transaction
   * @returns Created transactions
   */
  async createMany(
    dataArray: CreateTransactionData[],
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      return await client.transaction.createMany({
        data: dataArray.map(toColumns),
        skipDuplicates: true, // Skip duplicates instead of throwing error
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to create transactions: ${error.message}`
          : "An unexpected error occurred while creating transactions";
      throw new AppError(message, 500);
    }
  }

  /**
   * Update a transaction by provider transaction ID and account ID
   * @param data - Transaction update data
   * @param client - Optional transaction client to run inside a transaction
   * @returns Updated transaction
   * @throws NotFoundError if transaction not found
   * @throws AppError if database error occurs
   */
  async update(
    data: UpdateTransactionData,
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      const { providerTransactionId, accountId, ...updateData } = data;
      return await client.transaction.update({
        where: {
          providerTransactionId_accountId: {
            providerTransactionId,
            accountId,
          },
        },
        data: toColumns(updateData),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundError("Transaction not found");
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to update transaction: ${error.message}`
          : "An unexpected error occurred while updating transaction";
      throw new AppError(message, 500);
    }
  }

  /**
   * Update multiple transactions
   * Uses updateMany for bulk updates
   * @param updates - Array of transaction updates
   * @param client - Optional transaction client. Without one the updates run in
   *   their own transaction; with one they join the caller's.
   */
  async updateMany(
    updates: UpdateTransactionData[],
    client?: Prisma.TransactionClient
  ) {
    // Prisma doesn't support bulk update with different data per row, so update
    // each one, all inside one transaction
    const updateAll = (db: Prisma.TransactionClient) =>
      Promise.all(updates.map((update) => this.update(update, db)));

    try {
      return await (client
        ? updateAll(client)
        : this.prisma.$transaction((tx) => updateAll(tx)));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to update transactions: ${error.message}`
          : "An unexpected error occurred while updating transactions";
      throw new AppError(message, 500);
    }
  }

  /**
   * Delete transactions by provider transaction IDs
   * @param transactionIds - Array of provider transaction IDs
   * @param client - Optional transaction client to run inside a transaction
   * @returns Count of deleted transactions
   */
  async deleteMany(
    transactionIds: string[],
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      return await client.transaction.deleteMany({
        where: {
          providerTransactionId: {
            in: transactionIds,
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to delete transactions: ${error.message}`
          : "An unexpected error occurred while deleting transactions";
      throw new AppError(message, 500);
    }
  }

  /**
   * Delete transactions by item ID
   * @param itemId - the item ID to remove the transactions for
   * @param client - Optional transaction client to run the delete inside a transaction
   * @returns Count of deleted transactions
   */
  async deleteByItemId(
    itemId: string,
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      return await client.transaction.deleteMany({
        where: { itemId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to delete transactions: ${error.message}`
          : "An unexpected error occurred while deleting transactions";
      throw new AppError(message, 500);
    }
  }

  /**
   * Get all transactions for a user with optional filters and pagination
   * @param userId - User ID
   * @param filters - Optional filters (itemId, accountId, startDate, endDate)
   * @param pagination - Optional pagination (page, limit)
   * @returns Paginated transactions with metadata
   */
  async getAllByUserId(
    userId: string,
    filters?: {
      itemId?: string;
      accountId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination?: {
      page?: number;
      limit?: number;
    }
  ) {
    try {
      // Build where clause
      const where: Prisma.TransactionWhereInput = {
        userId,
        ...(filters?.itemId && { itemId: filters.itemId }),
        ...(filters?.accountId && { accountId: filters.accountId }),
        ...(filters?.startDate || filters?.endDate
          ? {
              date: {
                ...(filters?.startDate && { gte: filters.startDate }),
                ...(filters?.endDate && { lte: filters.endDate }),
              },
            }
          : {}),
      };

      // Pagination defaults
      const page = pagination?.page ?? 1;
      const limit = pagination?.limit ?? 50;
      const skip = (page - 1) * limit;

      // Get total count for pagination metadata
      const total = await this.prisma.transaction.count({ where });

      // Get paginated transactions with account information
      const transactions = await this.prisma.transaction.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              mask: true,
            },
          },
        },
        orderBy: {
          date: "desc",
        },
        skip,
        take: limit,
      });

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get transactions: ${error.message}`
          : "An unexpected error occurred while getting transactions";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const transactionRepository = new TransactionRepository(prisma);
