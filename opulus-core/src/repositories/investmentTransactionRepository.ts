import { Prisma, PrismaClient } from "@prisma/client";
import type { InvestmentTransaction as PlaidInvestmentTransaction } from "plaid";
import prisma from "../client/prisma.js";
import {
  ADDED_SUBTYPES,
  DIVIDEND_SUBTYPES,
  REMOVED_SUBTYPES,
  type ActivityKind,
} from "../types/dto/investments/getActivity.js";
import { AppError } from "../utils/errors.js";
import {
  upsertSecurities,
  type NormalizedSecurity,
} from "./holdingRepository.js";

export interface ActivityFilters {
  accountId?: string;
  kind?: ActivityKind;
  /** First day, inclusive. */
  from?: Date;
  /** Last day, inclusive (the whole day). */
  to?: Date;
}

/** The cash subtypes that make each cash kind. */
const CASH_SUBTYPES = {
  dividend: DIVIDEND_SUBTYPES,
  added: ADDED_SUBTYPES,
  removed: REMOVED_SUBTYPES,
};

/** Which rows a kind is: its type, and for cash movements its subtypes. */
function kindWhere(kind: ActivityKind): Prisma.InvestmentTransactionWhereInput {
  switch (kind) {
    case "buy":
    case "sell":
    case "fee":
      return { type: kind };
    case "dividend":
    case "added":
    case "removed":
      return { type: "cash", subtype: { in: CASH_SUBTYPES[kind] } };
    case "other": {
      // Written out because SQL's NOT over a null subtype is never true.
      const known = Object.values(CASH_SUBTYPES).flat();
      return {
        type: { notIn: ["buy", "sell", "fee"] },
        OR: [
          { type: { not: "cash" } },
          { subtype: null },
          { subtype: { notIn: known } },
        ],
      };
    }
  }
}

function activityWhere(
  userId: string,
  filters: ActivityFilters
): Prisma.InvestmentTransactionWhereInput {
  const { accountId, kind, from, to } = filters;
  return {
    userId,
    ...(accountId && { accountId }),
    ...((from || to) && {
      date: {
        ...(from && { gte: from }),
        ...(to && { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) }),
      },
    }),
    ...(kind && kindWhere(kind)),
  };
}

function wrapDatabaseError(error: unknown, what: string): AppError {
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

/** An investment transaction ready to store, keyed by Plaid's account and security ids. */
export interface NormalizedInvestmentTransaction {
  plaidInvestmentTransactionId: string;
  providerAccountId: string;
  plaidSecurityId: string | null;
  data: {
    date: Date;
    name: string;
    type: string;
    subtype: string | null;
    quantity: number | null;
    price: number | null;
    amount: number;
    fees: number | null;
    isoCurrencyCode: string | null;
    unofficialCurrencyCode: string | null;
  };
}

/**
 * Normalize one of Plaid's investment transactions. `amount` keeps Plaid's sign:
 * positive when cash leaves the account (a purchase, a fee), negative when it
 * comes in (a sale, a dividend). A cash movement has no quantity or price worth
 * keeping, so they are null when Plaid sends zero for a transaction with no
 * security.
 */
export function normalizePlaidInvestmentTransaction(
  transaction: PlaidInvestmentTransaction
): NormalizedInvestmentTransaction {
  const hasSecurity = Boolean(transaction.security_id);
  return {
    plaidInvestmentTransactionId: transaction.investment_transaction_id,
    providerAccountId: transaction.account_id,
    plaidSecurityId: transaction.security_id ?? null,
    data: {
      date: new Date(transaction.date),
      name: transaction.name,
      type: transaction.type,
      subtype: transaction.subtype ?? null,
      quantity: hasSecurity ? (transaction.quantity ?? null) : null,
      price: hasSecurity ? (transaction.price ?? null) : null,
      amount: transaction.amount ?? 0,
      fees: transaction.fees ?? null,
      isoCurrencyCode: transaction.iso_currency_code ?? null,
      unofficialCurrencyCode: transaction.unofficial_currency_code ?? null,
    },
  };
}

/**
 * Repository for investment transactions. Plaid can change or cancel a recent
 * one, so a sync replaces everything in the period it covered rather than
 * adding to it.
 */
class InvestmentTransactionRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Store what Plaid reports for a period: upsert the securities, delete the
   * item's stored transactions of these accounts that fall in the period, and
   * write the reported ones, all in one transaction so a reader never sees half.
   * @param item - The item (and user) the transactions belong to
   * @param accountIds - Our ids of the accounts the period covers
   * @param period - First and last day (inclusive) that was fetched
   * @param securities - The securities the transactions mention
   * @param rows - Each transaction, with our account id
   * @param client - Optional transaction client to join the caller's
   * @throws AppError if database error occurs
   */
  async replacePeriod(
    item: { id: string; userId: string },
    accountIds: string[],
    period: { from: Date; to: Date },
    securities: NormalizedSecurity[],
    rows: Array<
      Omit<NormalizedInvestmentTransaction, "providerAccountId"> & {
        accountId: string;
      }
    >,
    client?: Prisma.TransactionClient
  ): Promise<void> {
    const write = async (tx: Prisma.TransactionClient) => {
      const securityIds = await upsertSecurities(tx, securities);

      await tx.investmentTransaction.deleteMany({
        where: {
          accountId: { in: accountIds },
          date: { gte: period.from, lte: period.to },
        },
      });

      await tx.investmentTransaction.createMany({
        data: rows.map(
          ({
            accountId,
            plaidInvestmentTransactionId,
            plaidSecurityId,
            data,
          }) => ({
            ...data,
            plaidInvestmentTransactionId,
            accountId,
            securityId: plaidSecurityId
              ? (securityIds.get(plaidSecurityId) ?? null)
              : null,
            itemId: item.id,
            userId: item.userId,
          })
        ),
        // Plaid ids are unique; one that is already stored elsewhere is left alone.
        skipDuplicates: true,
      });
    };

    try {
      await (client ? write(client) : this.prisma.$transaction(write));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to store investment transactions: ${error.message}`
          : "An unexpected error occurred while storing investment transactions";
      throw new AppError(message, 500);
    }
  }

  /**
   * A page of a user's investment transactions, newest first, with the
   * security, account and institution the activity DTO names. Only the user's
   * own, whatever the filters.
   * @param userId - The user
   * @param filters - Account (our id), kind, and first / last day (inclusive)
   * @param paging - 1-based page and its size
   * @throws AppError if database error occurs
   */
  async getPageByUserId(
    userId: string,
    filters: ActivityFilters,
    paging: { page: number; limit: number }
  ) {
    const where = activityWhere(userId, filters);
    try {
      const [rows, total] = await Promise.all([
        this.prisma.investmentTransaction.findMany({
          where,
          include: {
            security: { select: { id: true, name: true, tickerSymbol: true } },
            account: { select: { name: true, subtype: true, mask: true } },
            item: { select: { institutionName: true } },
          },
          orderBy: [{ date: "desc" }, { id: "desc" }],
          skip: (paging.page - 1) * paging.limit,
          take: paging.limit,
        }),
        this.prisma.investmentTransaction.count({ where }),
      ]);
      return {
        rows,
        pagination: {
          page: paging.page,
          limit: paging.limit,
          total,
          totalPages: Math.ceil(total / paging.limit),
        },
      };
    } catch (error) {
      throw wrapDatabaseError(error, "get investment transactions");
    }
  }

  /**
   * What the summary adds up: the type, subtype, amount, fees and currency of a
   * user's investment transactions since a day.
   * @param userId - The user
   * @param since - First day (inclusive)
   * @throws AppError if database error occurs
   */
  async getForSummary(userId: string, since: Date, accountId?: string) {
    try {
      return await this.prisma.investmentTransaction.findMany({
        where: { userId, accountId, date: { gte: since } },
        select: {
          date: true,
          type: true,
          subtype: true,
          amount: true,
          fees: true,
          isoCurrencyCode: true,
        },
      });
    } catch (error) {
      throw wrapDatabaseError(error, "get investment transactions");
    }
  }
}

// Export singleton instance
export const investmentTransactionRepository =
  new InvestmentTransactionRepository(prisma);
