import { Prisma, PrismaClient } from "@prisma/client";
import type { AccountBase as PlaidAccount } from "plaid";
import prisma from "../client/prisma.js";
import { AppError, ConflictError } from "../utils/errors.js";

export interface CreateBankAccountData {
  providerAccountId: string;
  persistentAccountId?: string | null;
  itemId: string;
  userId: string;
  name: string;
  officialName?: string | null;
  type: string;
  subtype?: string | null;
  mask?: string | null;
  balanceAvailable?: number | null;
  balanceCurrent?: number | null;
  balanceLimit?: number | null;
  isoCurrencyCode?: string | null;
  unofficialCurrencyCode?: string | null;
}

/**
 * Normalize Plaid Account to CreateBankAccountData format
 * Handles field name mapping and type conversions
 */
export function normalizePlaidAccount(
  plaidAccount: PlaidAccount,
  itemId: string,
  userId: string
): CreateBankAccountData {
  return {
    providerAccountId: plaidAccount.account_id,
    persistentAccountId: plaidAccount.persistent_account_id ?? null,
    itemId,
    userId,
    name: plaidAccount.name,
    officialName: plaidAccount.official_name ?? null,
    type: plaidAccount.type,
    subtype: plaidAccount.subtype ?? null,
    mask: plaidAccount.mask ?? null,
    balanceAvailable: plaidAccount.balances.available ?? null,
    balanceCurrent: plaidAccount.balances.current ?? null,
    balanceLimit: plaidAccount.balances.limit ?? null,
    isoCurrencyCode: plaidAccount.balances.iso_currency_code ?? null,
    unofficialCurrencyCode:
      plaidAccount.balances.unofficial_currency_code ?? null,
  };
}

class BankAccountService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateBankAccountData) {
    try {
      return await this.prisma.bankAccount.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new ConflictError("Bank account already exists");
        }
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to create bank account: ${error.message}`
          : "An unexpected error occurred while creating bank account";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const bankAccountService = new BankAccountService(prisma);
