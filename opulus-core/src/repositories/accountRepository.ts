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
} satisfies Prisma.AccountSelect;

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
): Prisma.AccountWhereInput {
  if (!types?.length) return {};

  const exact = types
    .filter((type) => type !== "other")
    // Plaid's deprecated "brokerage" type is an alias for "investment".
    .flatMap((type) =>
      type === "investment" ? ["investment", "brokerage"] : [type]
    );
  const clauses: Prisma.AccountWhereInput[] = [];
  if (exact.length > 0) clauses.push({ type: { in: exact } });
  if (types.includes("other")) {
    clauses.push({ type: { notIn: KNOWN_PLAID_TYPES } });
  }
  return { OR: clauses };
}

export interface CreateAccountData {
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

/** The details of an account that can change when Plaid is re-read. */
export type UpdateAccountData = Partial<
  Omit<CreateAccountData, "itemId" | "userId" | "providerAccountId">
>;

/**
 * Normalize Plaid Account to CreateAccountData format
 * Handles field name mapping and type conversions
 */
export function normalizePlaidAccount(
  plaidAccount: PlaidAccount,
  itemId: string,
  userId: string
): CreateAccountData {
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

class AccountRepository {
  constructor(private prisma: PrismaClient) {}

  async create(
    data: CreateAccountData,
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      return await client.account.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new ConflictError("Account already exists");
        }
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to create account: ${error.message}`
          : "An unexpected error occurred while creating account";
      throw new AppError(message, 500);
    }
  }

  /**
   * Delete accounts by item ID
   * @param itemId - the item ID to remove the accounts for
   * @param client - Optional transaction client to run the delete inside a transaction
   * @returns Count of deleted accounts
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
      return await this.prisma.account.findMany({
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
          ? `Failed to get accounts: ${error.message}`
          : "An unexpected error occurred while fetching accounts";
      throw new AppError(message, 500);
    }
  }

  /**
   * Find one of an item's accounts by Plaid's account id
   * @param itemId - The item the account belongs to
   * @param providerAccountId - Plaid's account id
   * @param client - Optional transaction client to run inside a transaction
   * @returns The account's id, or null if we don't have it
   * @throws AppError if database error occurs
   */
  async findIdByProviderAccountId(
    itemId: string,
    providerAccountId: string,
    client: Prisma.TransactionClient = this.prisma
  ): Promise<string | null> {
    try {
      const account = await client.account.findUnique({
        where: { providerAccountId_itemId: { providerAccountId, itemId } },
        select: { id: true },
      });
      return account?.id ?? null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get account: ${error.message}`
          : "An unexpected error occurred while fetching account";
      throw new AppError(message, 500);
    }
  }

  /**
   * Update an account's details
   * @param id - The account id
   * @param data - The fields to change
   * @param client - Optional transaction client to run inside a transaction
   * @throws AppError if database error occurs
   */
  async update(
    id: string,
    data: UpdateAccountData,
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      return await client.account.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to update account: ${error.message}`
          : "An unexpected error occurred while updating account";
      throw new AppError(message, 500);
    }
  }

  /**
   * Look up our account ids for some of an item's accounts, by Plaid's ids
   * @param itemId - The item the accounts belong to
   * @param providerAccountIds - Plaid account ids to look up
   * @returns Map of Plaid account id to our account id (ids we don't have are absent)
   * @throws AppError if database error occurs
   */
  async getIdsByProviderAccountIds(
    itemId: string,
    providerAccountIds: string[]
  ): Promise<Map<string, string>> {
    try {
      const accounts = await this.prisma.account.findMany({
        where: { itemId, providerAccountId: { in: providerAccountIds } },
        select: { id: true, providerAccountId: true },
      });
      return new Map(
        accounts.map((account) => [account.providerAccountId, account.id])
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get accounts: ${error.message}`
          : "An unexpected error occurred while fetching accounts";
      throw new AppError(message, 500);
    }
  }

  async deleteByItemId(
    itemId: string,
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      return await client.account.deleteMany({
        where: { itemId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to delete accounts: ${error.message}`
          : "An unexpected error occurred while deleting accounts";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const accountRepository = new AccountRepository(prisma);
