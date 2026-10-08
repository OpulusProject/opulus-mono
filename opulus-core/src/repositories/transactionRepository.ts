import { Prisma, PrismaClient } from "@prisma/client";
import type { Transaction as PlaidTransaction } from "plaid";
import prisma from "../client/prisma.js";
import {
  UNCATEGORIZED,
  type TransactionsSummary,
} from "../types/dto/transactions/index.js";
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
 * Which of a user's transactions to include. Every field is optional and they
 * combine (a transaction must match all of them).
 */
export interface TransactionFilters {
  /** Only these connections. */
  itemIds?: string[];
  /** Only these accounts. */
  accountIds?: string[];
  /**
   * Only these categories (Plaid's high-level `primary` values). Include
   * UNCATEGORIZED to also match transactions without one.
   */
  categories?: string[];
  /** Text to find in the name or merchant name, ignoring case. */
  search?: string;
  /** inflow = money in, outflow = money out. */
  type?: "inflow" | "outflow";
  /** Leave out transfers between accounts and credit card payments. */
  hideTransfers?: boolean;
  /** Include pending transactions (default true). */
  includePending?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface TransactionSort {
  by: "date" | "amount";
  order: "asc" | "desc";
}

/**
 * What counts as a transfer, for `hideTransfers`. Moving money between your own
 * accounts and paying a credit card from checking would otherwise be counted as
 * spending twice. Mortgage, car and other loan payments are real expenses, so
 * only the credit card payment is left out of the loan payments.
 */
const TRANSFER_PRIMARY_CATEGORIES = ["TRANSFER_IN", "TRANSFER_OUT"];
const TRANSFER_DETAILED_CATEGORIES = ["LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"];

/**
 * The where clause for a user's transactions and a set of filters. The list and
 * the summary both use it, so they always agree on what is "filtered".
 */
function buildWhere(
  userId: string,
  filters: TransactionFilters
): Prisma.TransactionWhereInput {
  const and: Prisma.TransactionWhereInput[] = [{ userId }];

  if (filters.itemIds?.length) {
    and.push({ itemId: { in: filters.itemIds } });
  }
  if (filters.accountIds?.length) {
    and.push({ accountId: { in: filters.accountIds } });
  }

  if (filters.categories?.length) {
    const named = filters.categories.filter((c) => c !== UNCATEGORIZED);
    and.push({
      OR: [
        ...(named.length ? [{ categoryPrimary: { in: named } }] : []),
        ...(filters.categories.includes(UNCATEGORIZED)
          ? [{ categoryPrimary: null }]
          : []),
      ],
    });
  }

  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { merchantName: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }

  if (filters.type === "outflow") and.push({ amount: { gt: 0 } });
  if (filters.type === "inflow") and.push({ amount: { lt: 0 } });

  if (filters.hideTransfers) {
    // Spelled out with IS NULL cases: a plain NOT IN would also drop the rows
    // that have no category, since NULL is neither in nor out of a list.
    and.push(
      {
        OR: [
          { categoryPrimary: null },
          { categoryPrimary: { notIn: TRANSFER_PRIMARY_CATEGORIES } },
        ],
      },
      {
        OR: [
          { categoryDetailed: null },
          { categoryDetailed: { notIn: TRANSFER_DETAILED_CATEGORIES } },
        ],
      }
    );
  }

  if (filters.includePending === false) and.push({ pending: false });

  if (filters.startDate || filters.endDate) {
    and.push({
      date: {
        ...(filters.startDate && { gte: filters.startDate }),
        ...(filters.endDate && { lte: filters.endDate }),
      },
    });
  }

  return { AND: and };
}

/**
 * The sort order, always ending with the id so that rows with the same date (or
 * amount) have one fixed order. Without that, paging could repeat or skip them.
 */
function buildOrderBy(
  sort: TransactionSort
): Prisma.TransactionOrderByWithRelationInput[] {
  return sort.by === "amount"
    ? [{ amount: sort.order }, { date: "desc" }, { id: "desc" }]
    : [{ date: sort.order }, { id: sort.order }];
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
   * Get a user's transactions with filters, sorting and pagination
   * @param userId - The user ID
   * @param filters - Which transactions to include
   * @param pagination - Page number (from 1) and page size (default 50)
   * @param sort - What to sort by (date newest first by default). Ties are
   *   broken by id, so a page never repeats or skips a row.
   * @returns The page of transactions (with their account) and pagination
   *   details for the whole filtered set
   * @throws AppError if database error occurs
   */
  async getAllByUserId(
    userId: string,
    filters: TransactionFilters = {},
    pagination: { page?: number; limit?: number } = {},
    sort: TransactionSort = { by: "date", order: "desc" }
  ) {
    try {
      const where = buildWhere(userId, filters);

      const page = pagination.page ?? 1;
      const limit = pagination.limit ?? 50;
      const skip = (page - 1) * limit;

      const total = await this.prisma.transaction.count({ where });

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
        orderBy: buildOrderBy(sort),
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
   * Summarize a user's transactions for the same filters as the list: totals
   * per currency, spending by category, and spending by day. Only money out
   * counts as spending. The category breakdown ignores the `category` filter,
   * so a category can be chosen from the full picture.
   * @param userId - The user ID
   * @param filters - Which transactions to include
   * @throws AppError if database error occurs
   */
  async getSummaryByUserId(
    userId: string,
    filters: TransactionFilters = {}
  ): Promise<TransactionsSummary> {
    try {
      const where = buildWhere(userId, filters);
      const whereAnyCategory = buildWhere(userId, {
        ...filters,
        categories: undefined,
      });
      const moneyOut = (base: Prisma.TransactionWhereInput) => ({
        AND: [base, { amount: { gt: 0 } }],
      });
      const moneyIn = (base: Prisma.TransactionWhereInput) => ({
        AND: [base, { amount: { lt: 0 } }],
      });

      const [spent, income, counts, byCategory, byDay] = await Promise.all([
        this.prisma.transaction.groupBy({
          by: ["isoCurrencyCode"],
          where: moneyOut(where),
          _sum: { amount: true },
        }),
        this.prisma.transaction.groupBy({
          by: ["isoCurrencyCode"],
          where: moneyIn(where),
          _sum: { amount: true },
        }),
        this.prisma.transaction.groupBy({
          by: ["isoCurrencyCode"],
          where,
          _count: { _all: true },
        }),
        this.prisma.transaction.groupBy({
          by: ["isoCurrencyCode", "categoryPrimary"],
          where: moneyOut(whereAnyCategory),
          _sum: { amount: true },
          _count: { _all: true },
        }),
        this.prisma.transaction.groupBy({
          by: ["isoCurrencyCode", "date"],
          where: moneyOut(where),
          _sum: { amount: true },
        }),
      ]);

      const zero = new Prisma.Decimal(0);
      const spentBy = new Map(
        spent.map((row) => [row.isoCurrencyCode, row._sum.amount ?? zero])
      );
      const incomeBy = new Map(
        income.map((row) => [row.isoCurrencyCode, row._sum.amount ?? zero])
      );

      return {
        totals: counts.map((row) => ({
          currency: row.isoCurrencyCode,
          spent: spentBy.get(row.isoCurrencyCode) ?? zero,
          // Money in is negative; report it as a positive amount.
          income: (incomeBy.get(row.isoCurrencyCode) ?? zero).negated(),
          count: row._count._all,
        })),
        byCategory: byCategory.map((row) => ({
          currency: row.isoCurrencyCode,
          category: row.categoryPrimary,
          spent: row._sum.amount ?? zero,
          count: row._count._all,
        })),
        byDay: byDay.map((row) => ({
          currency: row.isoCurrencyCode,
          date: row.date,
          spent: row._sum.amount ?? zero,
        })),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to summarize transactions: ${error.message}`
          : "An unexpected error occurred while summarizing transactions";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const transactionRepository = new TransactionRepository(prisma);
