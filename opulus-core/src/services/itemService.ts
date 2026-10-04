import { Prisma, PrismaClient } from "@prisma/client";
import type { Item as PlaidItem } from "plaid";
import prisma from "../client/prisma.js";
import { logger } from "../utils/logger.js";
import { AppError, ConflictError, NotFoundError } from "../utils/errors.js";
import { normalizePlaidAccount } from "./bankAccountService.js";
import { plaidService } from "./plaidService.js";

export interface CreateItemData {
  plaidItemId: string;
  userId: string;
  accessToken: string;
  institutionId?: string | null;
  institutionName?: string | null;
  institutionColor?: string | null;
  institutionLogo?: string | null;
  webhook?: string | null;
  error?: string | null;
  availableProducts: string[];
  billedProducts: string[];
  products?: string[];
  updateType: string;
  consentExpirationTime?: Date | null;
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
    error: plaidItem.error ? JSON.stringify(plaidItem.error) : null,
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
 * Service for managing Plaid items
 * Handles item creation and retrieval
 */
class ItemService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a Plaid item in the database
   * @param data - Item data
   * @returns Created item
   * @throws ConflictError if item already exists
   * @throws AppError if database error occurs
   */
  async create(data: CreateItemData) {
    try {
      return await this.prisma.item.create({ data });
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
      return await this.prisma.item.findUniqueOrThrow({
        where: { id },
      });
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

  async getByPlaidItemId(plaidItemId: string) {
    try {
      const item = await this.prisma.item.findUniqueOrThrow({
        where: { plaidItemId },
      });

      return item;
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
   * @returns Updated item
   * @throws NotFoundError if item not found
   * @throws AppError if database error occurs
   */
  async update(itemId: string, data: Prisma.ItemUpdateInput) {
    try {
      return await this.prisma.item.update({
        where: { id: itemId },
        data,
      });
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
   * Get all items for a user with their bank accounts
   * @param userId - The user ID
   * @returns Array of items with bank accounts (excluding credit accounts)
   * @throws AppError if database error occurs
   */
  /**
   * List every item. Used by the reconcile CLI to walk the full catalog.
   */
  async listAll() {
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
        include: {
          bankAccounts: {
            select: {
              id: true,
              name: true,
              type: true,
              balanceAvailable: true,
              balanceCurrent: true,
              balanceLimit: true,
            },
          },
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
}

// Export singleton instance
export const itemService = new ItemService(prisma);

/**
 * Exchange a Plaid public token for an access token and persist the Item
 * and its initial accounts.
 *
 * Idempotent on `plaidItemId`: if the Item already exists (e.g. the user
 * re-linked the same institution/login), we refresh the stored access token
 * — Plaid issues a new one on each successful exchange and invalidates the
 * previous one — and return the existing Item without touching accounts.
 *
 * Callers that need to reconcile accounts after a re-link should invoke
 * `itemService.syncAccounts(itemId)` separately.
 */
export async function createItemFromPublicToken(
  userId: string,
  publicToken: string
) {
  const exchange = await plaidService.exchangePublicToken(publicToken);
  const accessToken = exchange.access_token;

  const { item } = await plaidService.getItem(accessToken);

  let institution: {
    name: string;
    logo?: string | null;
    primary_color?: string | null;
  } | null = null;

  if (item.institution_id) {
    try {
      const institutionResponse = await plaidService.getInstitutionById(
        item.institution_id
      );
      institution = institutionResponse.institution;
    } catch (error) {
      logger.warn(
        {
          institution_id: item.institution_id,
          error_message:
            error instanceof Error ? error.message : String(error),
        },
        "Failed to fetch institution (optional)"
      );
    }
  }

  const accountsResponse = await plaidService.getAccounts(accessToken);
  const itemData = normalizePlaidItem(item, userId, accessToken, institution);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.item.findUnique({
      where: { plaidItemId: itemData.plaidItemId },
    });

    if (existing) {
      // Plaid rotated the access token on this exchange; keep ours fresh.
      const updated = await tx.item.update({
        where: { id: existing.id },
        data: { accessToken },
      });
      logger.info(
        { plaid_item_id: itemData.plaidItemId, item_id: existing.id },
        "Item already exists; refreshed access token (idempotent re-link)"
      );
      return updated;
    }

    const createdItem = await tx.item.create({ data: itemData });

    for (const plaidAccount of accountsResponse.accounts) {
      const accountData = normalizePlaidAccount(
        plaidAccount,
        createdItem.id,
        userId
      );
      await tx.bankAccount.create({ data: accountData });
    }

    logger.info(
      {
        item_id: createdItem.id,
        plaid_item_id: itemData.plaidItemId,
        user_id: userId,
        accounts_count: accountsResponse.accounts.length,
      },
      "Item and accounts created"
    );

    return createdItem;
  });
}

/**
 * Reconcile a persisted Item's bank accounts with Plaid's current view
 * (`/accounts/get`). Used after a Link update-mode session where the user
 * added accounts via `update.account_selection_enabled: true`.
 *
 * Semantics for this pass: **upsert-only**. New Plaid accounts are inserted,
 * existing ones have their mutable fields (balances, name, mask, …) refreshed.
 * Accounts the user *de-selected* are left in the DB untouched; Plaid simply
 * stops returning data for them. This is intentional to avoid cascade-deleting
 * historical Transaction rows. A future PR can introduce soft-deletion.
 */
export async function syncItemAccountsFromPlaid(itemId: string) {
  const item = await itemService.getById(itemId);
  const accountsResponse = await plaidService.getAccounts(item.accessToken);

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const plaidAccount of accountsResponse.accounts) {
      const data = normalizePlaidAccount(plaidAccount, item.id, item.userId);
      const existing = await tx.bankAccount.findFirst({
        where: { itemId: item.id, providerAccountId: data.providerAccountId },
        select: { id: true },
      });

      if (existing) {
        await tx.bankAccount.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            officialName: data.officialName,
            type: data.type,
            subtype: data.subtype,
            mask: data.mask,
            balanceAvailable: data.balanceAvailable,
            balanceCurrent: data.balanceCurrent,
            balanceLimit: data.balanceLimit,
            isoCurrencyCode: data.isoCurrencyCode,
            unofficialCurrencyCode: data.unofficialCurrencyCode,
            persistentAccountId: data.persistentAccountId,
          },
        });
        updated += 1;
      } else {
        await tx.bankAccount.create({ data });
        created += 1;
      }
    }
  });

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: item.plaidItemId,
      user_id: item.userId,
      accounts_total: accountsResponse.accounts.length,
      accounts_created: created,
      accounts_updated: updated,
    },
    "Item accounts synced from Plaid"
  );

  return { itemId: item.id, created, updated };
}
