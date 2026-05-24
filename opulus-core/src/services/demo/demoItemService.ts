/**
 * Demo Item Service
 * Returns mock data without any database calls
 * Implements the same interface as ItemService but returns static mock data
 */

import type { CreateItemData } from "../itemService.js";
import { demoItems } from "./demoData.js";

/**
 * Demo Item Service - No database, no network calls
 * Returns mock data that matches the real service's return types
 */
class DemoItemService {
  /**
   * Create a Plaid item (demo mode - no-op, returns mock)
   * In demo mode, we don't actually create items
   */
  async create(data: CreateItemData) {
    // In demo mode, we don't persist anything
    // Return a mock item that matches the database model shape
    return {
      id: `demo-item-${Date.now()}`,
      plaidItemId: data.plaidItemId,
      userId: data.userId,
      accessToken: "demo-access-token",
      institutionId: data.institutionId,
      institutionName: data.institutionName,
      institutionColor: data.institutionColor,
      institutionLogo: data.institutionLogo,
      webhook: data.webhook,
      error: data.error,
      availableProducts: data.availableProducts,
      billedProducts: data.billedProducts,
      products: data.products,
      updateType: data.updateType,
      consentExpirationTime: data.consentExpirationTime,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get an item by Plaid item ID (demo mode - returns mock)
   */
  async getByPlaidItemId(plaidItemId: string) {
    // Return first demo item or create a mock one
    const demoItem = demoItems[0];
    return {
      id: demoItem.id,
      plaidItemId,
      userId: "demo-user-id",
      accessToken: "demo-access-token",
      institutionId: null,
      institutionName: demoItem.institutionName,
      institutionColor: demoItem.institutionColor,
      institutionLogo: demoItem.institutionLogo,
      webhook: null,
      error: demoItem.error,
      availableProducts: ["transactions"],
      billedProducts: ["transactions"],
      products: ["transactions"],
      updateType: "background",
      consentExpirationTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Update an item (demo mode - no-op, returns mock)
   */
  async update(itemId: string, _data: unknown) {
    // In demo mode, we don't persist updates
    // Return the mock item with updated fields
    const demoItem = demoItems.find((item) => item.id === itemId) || demoItems[0];
    return {
      id: demoItem.id,
      plaidItemId: "demo-plaid-item-id",
      userId: "demo-user-id",
      accessToken: "demo-access-token",
      institutionId: null,
      institutionName: demoItem.institutionName,
      institutionColor: demoItem.institutionColor,
      institutionLogo: demoItem.institutionLogo,
      webhook: null,
      error: demoItem.error,
      availableProducts: ["transactions"],
      billedProducts: ["transactions"],
      products: ["transactions"],
      updateType: "background",
      consentExpirationTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get all items for a user with their bank accounts
   * Returns mock data matching the Prisma query result shape
   * NO DATABASE CALLS - just returns static mock data
   */
  async getAllByUserId(userId: string) {
    // Return mock items with bankAccounts that match Prisma's include shape
    // This matches what the real service returns: items with bankAccounts relation
    return demoItems.map((item) => ({
      id: item.id,
      plaidItemId: `demo-plaid-${item.id}`,
      userId,
      accessToken: "demo-access-token",
      institutionId: null,
      institutionName: item.institutionName,
      institutionColor: item.institutionColor,
      institutionLogo: item.institutionLogo,
      webhook: null,
      error: item.error,
      availableProducts: ["transactions"],
      billedProducts: ["transactions"],
      products: ["transactions"],
      updateType: "background",
      consentExpirationTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Include bankAccounts relation (matches Prisma include)
      bankAccounts: item.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        balanceAvailable: account.balanceAvailable,
        balanceCurrent: account.balanceCurrent,
        balanceLimit: account.balanceLimit,
      })),
    }));
  }
}

// Export singleton instance
export const demoItemService = new DemoItemService();

