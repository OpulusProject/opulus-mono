import { Prisma, PrismaClient } from "@prisma/client";
import type { PlaidErrorType, Item as PlaidItem } from "plaid";
import prisma from "../client/prisma.js";
import { AppError, ConflictError, NotFoundError } from "../utils/errors.js";
import {
  decryptItemToken,
  encryptItemToken,
} from "../utils/itemTokenCrypto.js";
import { accountDtoSelect } from "./accountRepository.js";

export interface CreateItemData {
  plaidItemId: string;
  userId: string;
  accessToken: string;
  institutionId?: string | null;
  institutionName?: string | null;
  institutionColor?: string | null;
  institutionLogo?: string | null;
  webhook?: string | null;
  errorType?: PlaidErrorType | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  displayMessage?: string | null;
  availableProducts: string[];
  billedProducts: string[];
  products?: string[];
  updateType: string;
  consentExpirationTime?: Date | null;
}

/**
 * The item's four error columns for a Plaid error (or all null for no error).
 * Used wherever an error is stored or cleared so they always change together.
 */
export function toItemErrorData(
  error?: {
    error_type?: PlaidErrorType | string | null;
    error_code?: string | null;
    error_message?: string | null;
    display_message?: string | null;
  } | null
) {
  return {
    errorType: (error?.error_type as PlaidErrorType | null | undefined) ?? null,
    errorCode: error?.error_code ?? null,
    errorMessage: error?.error_message ?? null,
    displayMessage: error?.display_message ?? null,
  };
}

/**
 * Normalize Plaid Item to CreateItemData format
 * Handles field name mapping and type conversions
 * @param plaidItem - The Plaid item
 * @param userId - User ID
 * @param accessToken - Access token
 * @param institution - Optional institution data from Plaid (null for same-day micro deposits)
 */
export function normalizePlaidItem(
  plaidItem: PlaidItem,
  userId: string,
  accessToken: string,
  institution?: {
    name: string;
    logo?: string | null;
    primary_color?: string | null;
  } | null
): CreateItemData {
  return {
    plaidItemId: plaidItem.item_id,
    userId,
    accessToken,
    institutionId: plaidItem.institution_id ?? null,
    institutionName: institution?.name ?? null,
    institutionColor: institution?.primary_color ?? null,
    institutionLogo: institution?.logo ?? null,
    webhook: plaidItem.webhook ?? null,
    ...toItemErrorData(plaidItem.error),
    availableProducts: plaidItem.available_products.map((p) => p.toString()),
    billedProducts: plaidItem.billed_products.map((p) => p.toString()),
    products: plaidItem.products?.map((p) => p.toString()),
    updateType: plaidItem.update_type,
    consentExpirationTime: plaidItem.consent_expiration_time
      ? new Date(plaidItem.consent_expiration_time)
      : null,
  };
}

/**
 * Give a row read from the database its plaintext access token.
 *
 * `Item.accessToken` is stored encrypted (see utils/itemTokenCrypto.ts). The
 * repository is the only place that converts: every write encrypts and every
 * read that returns the token decrypts, so callers only ever see plaintext and
 * nothing else needs to know about the storage format.
 */
function withPlainToken<T extends { accessToken: string }>(row: T): T {
  return { ...row, accessToken: decryptItemToken(row.accessToken) };
}

/**
 * Repository for Plaid items
 * Handles item creation and retrieval
 */
class ItemRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a Plaid item in the database
   * @param data - Item data
   * @returns Created item
   * @throws ConflictError if item already exists
   * @throws AppError if database error occurs
   */
  async create(
    data: CreateItemData,
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      const row = await client.item.create({
        data: { ...data, accessToken: encryptItemToken(data.accessToken) },
      });
      return withPlainToken(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new ConflictError("Item already exists");
        }
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to create item: ${error.message}`
          : "An unexpected error occurred while creating item";
      throw new AppError(message, 500);
    }
  }

  /**
   * Get an item by Plaid item ID
   * @param plaidItemId - The Plaid item ID
   * @returns Item if found
   * @throws NotFoundError if item not found
   * @throws AppError if database error occurs
   */
  async getById(id: string) {
    try {
      const item = await this.prisma.item.findUniqueOrThrow({
        where: { id },
      });
      return withPlainToken(item);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundError("Item not found");
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get item: ${error.message}`
          : "An unexpected error occurred while fetching item";
      throw new AppError(message, 500);
    }
  }

  /**
   * Find the id of an item the user has already linked for an institution
   * @param userId - The user ID
   * @param institutionId - Plaid's institution id
   * @returns The item's id, or null if there is none
   * @throws AppError if database error occurs
   */
  async findIdByInstitution(
    userId: string,
    institutionId: string
  ): Promise<string | null> {
    try {
      const item = await this.prisma.item.findFirst({
        where: { userId, institutionId },
        select: { id: true },
      });
      return item?.id ?? null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to find item: ${error.message}`
          : "An unexpected error occurred while finding item";
      throw new AppError(message, 500);
    }
  }

  async getByPlaidItemId(plaidItemId: string) {
    try {
      const item = await this.prisma.item.findUniqueOrThrow({
        where: { plaidItemId },
      });

      return withPlainToken(item);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundError("Item not found");
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get item: ${error.message}`
          : "An unexpected error occurred while fetching item";
      throw new AppError(message, 500);
    }
  }

  /**
   * Update an item by ID
   * Only updates fields that are provided (undefined fields are ignored)
   * @param itemId - The item ID
   * @param data - Partial item data to update
   * @param client - Optional transaction client to run inside a transaction
   * @returns Updated item
   * @throws NotFoundError if item not found
   * @throws AppError if database error occurs
   */
  async update(
    itemId: string,
    data: Omit<Prisma.ItemUpdateInput, "accessToken"> & {
      accessToken?: string;
    },
    client: Prisma.TransactionClient = this.prisma
  ) {
    try {
      const row = await client.item.update({
        where: { id: itemId },
        data: {
          ...data,
          ...(data.accessToken !== undefined
            ? { accessToken: encryptItemToken(data.accessToken) }
            : {}),
        },
      });
      return withPlainToken(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundError("Item not found");
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to update item: ${error.message}`
          : "An unexpected error occurred while updating item";
      throw new AppError(message, 500);
    }
  }

  /**
   * Deletes an item by ID
   * @param itemId - the item ID
   * @param client - Optional transaction client to run the delete inside a transaction
   * @returns Deleted item
   */
  async delete(itemId: string, client: Prisma.TransactionClient = this.prisma) {
    try {
      const row = await client.item.delete({
        where: { id: itemId },
      });
      return withPlainToken(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to delete item: ${error.message}`
          : "An unexpected error occurred while deleting item";
      throw new AppError(message, 500);
    }
  }

  /**
   * Get all items for a user with their accounts
   * @param userId - The user ID
   * @returns Array of items with accounts (excluding credit accounts)
   * @throws AppError if database error occurs
   */
  /**
   * List every item. Used by the reconcile CLI to walk the full catalog.
   */
  async getAll() {
    try {
      return await this.prisma.item.findMany({
        select: {
          id: true,
          plaidItemId: true,
          institutionName: true,
          userId: true,
        },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to list items: ${error.message}`
          : "An unexpected error occurred while listing items";
      throw new AppError(message, 500);
    }
  }

  async getAllByUserId(userId: string) {
    try {
      const items = await this.prisma.item.findMany({
        where: { userId },
        // The list is for display; it never needs the token.
        omit: { accessToken: true },
        include: {
          accounts: { select: accountDtoSelect },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return items;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to get items: ${error.message}`
          : "An unexpected error occurred while fetching items";
      throw new AppError(message, 500);
    }
  }

  /**
   * Encrypt every access token still stored as legacy plaintext. Idempotent:
   * rows already encrypted are skipped, so it is safe to re-run. Used by the
   * backfill script only.
   * @param options.dryRun - Count the rows that would change without writing
   * @returns How many legacy rows were found and how many were encrypted
   * @throws AppError if database error occurs
   */
  async encryptLegacyAccessTokens(options: { dryRun?: boolean } = {}) {
    try {
      const rows = await this.prisma.item.findMany({
        where: { NOT: { accessToken: { startsWith: "enc:" } } },
        select: { id: true, accessToken: true },
      });

      let encrypted = 0;
      if (!options.dryRun) {
        for (const row of rows) {
          // Guard on the value we read so a concurrent writer is never clobbered.
          const result = await this.prisma.item.updateMany({
            where: { id: row.id, accessToken: row.accessToken },
            data: { accessToken: encryptItemToken(row.accessToken) },
          });
          encrypted += result.count;
        }
      }
      return { legacy: rows.length, encrypted };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to encrypt legacy item access tokens", 500);
    }
  }
}

// Export singleton instance
export const itemRepository = new ItemRepository(prisma);