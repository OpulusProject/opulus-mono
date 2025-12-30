import { Prisma, PrismaClient } from "@prisma/client";
import type { Item as PlaidItem } from "plaid";
import prisma from "../client/prisma.js";
import { AppError, ConflictError, NotFoundError } from "../utils/errors.js";

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
}

// Export singleton instance
export const itemService = new ItemService(prisma);
