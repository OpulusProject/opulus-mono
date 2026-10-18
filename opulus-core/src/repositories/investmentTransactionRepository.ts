import { Prisma, PrismaClient } from "@prisma/client";
import type { InvestmentTransaction as PlaidInvestmentTransaction } from "plaid";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";
import {
  upsertSecurities,
  type NormalizedSecurity,
} from "./holdingRepository.js";

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
}

// Export singleton instance
export const investmentTransactionRepository =
  new InvestmentTransactionRepository(prisma);
