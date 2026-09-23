import { Prisma, PrismaClient } from "@prisma/client";
import type { Transaction as PlaidTransaction } from "plaid";
import type { RemovedTransaction } from "../client/plaid.js";
import prisma from "../client/prisma.js";
import { logger } from "../utils/logger.js";
import { AppError, ConflictError, NotFoundError } from "../utils/errors.js";
import { itemService } from "./itemService.js";
import { plaidService } from "./plaidService.js";

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
  category: string[];
  categoryId?: string | null;
  personalFinanceCategory?: string | null;
  location?: string | null;
  paymentMeta?: string | null;
  isoCurrencyCode?: string | null;
  unofficialCurrencyCode?: string | null;
  pending: boolean;
  pendingTransactionId?: string | null;
  accountOwner?: string | null;
  transactionCode?: string | null;
  merchantEntityId?: string | null;
  checkNumber?: string | null;
  dateTransacted?: Date | null;
}

export interface UpdateTransactionData extends Partial<CreateTransactionData> {
  providerTransactionId: string;
  accountId: string;
}

export interface SyncItemResult {
  added: number;
  modified: number;
  removed: number;
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
    category: plaidTransaction.category ?? [],
    categoryId: plaidTransaction.category_id ?? null,
    personalFinanceCategory: plaidTransaction.personal_finance_category
      ? JSON.stringify(plaidTransaction.personal_finance_category)
      : null,
    location: plaidTransaction.location
      ? JSON.stringify(plaidTransaction.location)
      : null,
    paymentMeta: plaidTransaction.payment_meta
      ? JSON.stringify(plaidTransaction.payment_meta)
      : null,
    isoCurrencyCode: plaidTransaction.iso_currency_code ?? null,
    unofficialCurrencyCode: plaidTransaction.unofficial_currency_code ?? null,
    pending: plaidTransaction.pending ?? false,
    pendingTransactionId: plaidTransaction.pending_transaction_id ?? null,
    accountOwner: plaidTransaction.account_owner ?? null,
    transactionCode: plaidTransaction.transaction_code ?? null,
    merchantEntityId: plaidTransaction.merchant_entity_id ?? null,
    checkNumber: plaidTransaction.check_number ?? null,
    dateTransacted: null, // Plaid doesn't provide date_transacted in Transaction type
  };
}

/**
 * Service for managing Plaid transactions
 * Handles transaction creation, updates, and deletion
 */
class TransactionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a transaction in the database
   * @param data - Transaction data
   * @returns Created transaction
   * @throws ConflictError if transaction already exists
   * @throws AppError if database error occurs
   */
  async create(data: CreateTransactionData) {
    try {
      return await this.prisma.transaction.create({ data });
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
   * @returns Created transactions
   */
  async createMany(dataArray: CreateTransactionData[]) {
    try {
      return await this.prisma.transaction.createMany({
        data: dataArray,
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
   * @returns Updated transaction
   * @throws NotFoundError if transaction not found
   * @throws AppError if database error occurs
   */
  async update(data: UpdateTransactionData) {
    try {
      const { providerTransactionId, accountId, ...updateData } = data;
      return await this.prisma.transaction.update({
        where: {
          providerTransactionId_accountId: {
            providerTransactionId,
            accountId,
          },
        },
        data: updateData,
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
   */
  async updateMany(updates: UpdateTransactionData[]) {
    try {
      // Prisma doesn't support bulk update with different data per row
      // So we'll use a transaction to update each one
      return await this.prisma.$transaction(
        updates.map((update) => {
          const { providerTransactionId, accountId, ...updateData } = update;
          return this.prisma.transaction.update({
            where: {
              providerTransactionId_accountId: {
                providerTransactionId,
                accountId,
              },
            },
            data: updateData,
          });
        })
      );
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
   * @returns Count of deleted transactions
   */
  async deleteMany(transactionIds: string[]) {
    try {
      return await this.prisma.transaction.deleteMany({
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
          bankAccount: {
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

  /**
   * Sync transactions for a Plaid item from its stored cursor.
   * Shared by the TRANSACTIONS webhook handler and the reconcile CLI.
   */
  async syncForItem(plaidItemId: string): Promise<SyncItemResult> {
    try {
      const item = await itemService.getByPlaidItemId(plaidItemId);

    const syncResult = await plaidService.transactionsSync(
      item.accessToken,
      item.transactionCursor
    );

    const { added, modified, removed, nextCursor } = syncResult;

    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { itemId: item.id },
      select: {
        id: true,
        providerAccountId: true,
      },
    });

    const accountIdMap = new Map(
      bankAccounts.map((acc) => [acc.providerAccountId, acc.id])
    );

    await this.prisma.$transaction(async (tx) => {
      if (added.length > 0) {
        const transactionsToCreate = added
          .map((plaidTransaction) => {
            const accountId = accountIdMap.get(plaidTransaction.account_id);
            if (!accountId) {
              return null;
            }

            return normalizePlaidTransaction(
              plaidTransaction,
              accountId,
              item.id,
              item.userId
            );
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);

        if (transactionsToCreate.length > 0) {
          await tx.transaction.createMany({
            data: transactionsToCreate,
            skipDuplicates: true,
          });
        }
      }

      if (modified.length > 0) {
        const updatePromises = modified.map(async (plaidTransaction) => {
          const accountId = accountIdMap.get(plaidTransaction.account_id);
          if (!accountId) {
            return;
          }

          const transactionData = normalizePlaidTransaction(
            plaidTransaction,
            accountId,
            item.id,
            item.userId
          );

          const {
            providerTransactionId,
            accountId: txAccountId,
            ...updateData
          } = transactionData;

          await tx.transaction.update({
            where: {
              providerTransactionId_accountId: {
                providerTransactionId,
                accountId: txAccountId,
              },
            },
            data: updateData,
          });
        });

        await Promise.all(updatePromises);
      }

      if (removed.length > 0) {
        const transactionIdsToDelete = (removed as RemovedTransaction[]).map(
          (removedTx) => removedTx.transaction_id
        );

        if (transactionIdsToDelete.length > 0) {
          await tx.transaction.deleteMany({
            where: {
              providerTransactionId: {
                in: transactionIdsToDelete,
              },
            },
          });
        }
      }

      await tx.item.update({
        where: { id: item.id },
        data: { transactionCursor: nextCursor },
      });
    });

    const result: SyncItemResult = {
      added: added.length,
      modified: modified.length,
      removed: removed.length,
    };

    logger.info(
      {
        item_id: plaidItemId,
        added_count: result.added,
        modified_count: result.modified,
        removed_count: result.removed,
      },
      "Transactions synced successfully"
    );

      return result;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const message =
        error instanceof Error
          ? `Failed to sync transactions: ${error.message}`
          : "An unexpected error occurred while syncing transactions";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const transactionService = new TransactionService(prisma);
