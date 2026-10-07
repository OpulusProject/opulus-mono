import { Prisma, PrismaClient } from "@prisma/client";
import type { AccountBase as PlaidAccount } from "plaid";
import prisma from "../client/prisma.js";
import type { AccountType } from "../types/dto/accounts/getAccounts.js";
import { AppError, ConflictError } from "../utils/errors.js";

/**
 * Account columns exposed through the API (see toAccountDTO). Shared by every
 * query that returns accounts so they cannot drift apart.
 */
export const accountDtoSelect = {
  id: true,
  name: true,
  officialName: true,
  type: true,
  subtype: true,
  mask: true,
  balanceAvailable: true,
  balanceCurrent: true,
  balanceLimit: true,
  isoCurrencyCode: true,
  liabilityDetails: true,
} satisfies Prisma.BankAccountSelect;

/** Plaid types that map to a named account type; anything else is "other". */
const KNOWN_PLAID_TYPES = [
  "depository",
  "investment",
  "brokerage",
  "credit",
  "loan",
];

/** Build the `type` filter for the requested account types. */
function typeFilter(
  types: AccountType[] | undefined
): Prisma.BankAccountWhereInput {
  if (!types?.length) return {};

  const exact = types
    .filter((type) => type !== "other")
    // Plaid's deprecated "brokerage" type is an alias for "investment".
    .flatMap((type) =>
      type === "investment" ? ["investment", "brokerage"] : [type]
    );
  const clauses: Prisma.BankAccountWhereInput[] = [];
  if (exact.length > 0) clauses.push({ type: { in: exact } });
  if (types.includes("other")) {
    clauses.push({ type: { notIn: KNOWN_PLAID_TYPES } });
  }
  return { OR: clauses };
}

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

  /**
   * Delete bank accounts by item ID
   * @param itemId - the item ID to remove the bank accounts for
   * @param client - Optional transaction client to run the delete inside a transaction
   * @returns Count of deleted bank accounts
   */
  /**
   * Get a user's accounts across all their connections
   * @param userId - The user ID
   * @param types - Only accounts of these types (all accounts if omitted)
   * @returns Accounts with the connection each belongs to, by name
   * @throws AppError if database error occurs
   */
  async getAllByUserId(userId: string, types?: AccountType[]) {
    try {
      return await this.prisma.bankAccount.findMany({
        where: { userId, ...typeFilter(types) },
        select: {
          ...accountDtoSelect,
          item: {
            select: { id: true, institutionName: true, errorCode: true },
          },
        },
        orderBy: { name: "asc" },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get bank accounts: ${error.message}`
          : "An unexpected error occurred while fetching bank accounts";
      throw new AppError(message, 500);
    }
  }

  async deleteByItemId(
    itemId: string,
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      return await client.bankAccount.deleteMany({
        where: { itemId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to delete bank accounts: ${error.message}`
          : "An unexpected error occurred while deleting bank accounts";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const bankAccountService = new BankAccountService(prisma);
