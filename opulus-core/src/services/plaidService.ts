import {
  AccountsGetRequest,
  CountryCode,
  InstitutionsGetByIdRequest,
  ItemGetRequest,
  ItemPublicTokenExchangeRequest,
  LinkTokenCreateRequest,
  PlaidApi,
  Products,
  TransactionsRefreshRequest,
  TransactionsSyncRequest,
  UserCreateRequest,
} from "plaid";
import plaidClient from "../client/plaid.js";
import config from "../config/default.js";
import { handlePlaidError } from "../utils/plaidErrors.js";

/**
 * Service for managing Plaid integrations
 * Handles Plaid API interactions including users, tokens, items, and accounts
 */
class PlaidService {
  constructor(private plaid: PlaidApi) {}

  // ============================================================================
  // User Management
  // ============================================================================

  /**
   * Create a Plaid user
   * @param userId - User ID from your database
   * @returns Plaid user creation response
   */
  async createUser(userId: string) {
    const request: UserCreateRequest = {
      client_user_id: userId,
    };

    try {
      const response = await this.plaid.userCreate(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Link Token Management
  // ============================================================================

  /**
   * Create a Plaid Link token for the user
   * @param userToken - Plaid user token (from userCreate)
   * @param userId - User ID from your database
   * @returns Link token response from Plaid
   */
  async createLinkToken(userToken: string, userId: string) {
    const products: Products[] = [Products.Assets, Products.Transactions];
    const countryCodes: CountryCode[] = [CountryCode.Ca];

    const request: LinkTokenCreateRequest = {
      user_token: userToken,
      user: {
        client_user_id: userId,
      },
      client_name: "Opulus",
      enable_multi_item_link: true,
      products,
      country_codes: countryCodes,
      language: "en",
      transactions: {
        days_requested: 730,
      },
      ...(config.plaidWebhookUrl && {
        webhook: `${config.plaidWebhookUrl}`,
      }),
    };

    try {
      const response = await this.plaid.linkTokenCreate(request);
      return response.data;
    } catch (error) {
      console.error("[PLAID SERVICE] Link token creation failed:", error);
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Item Management
  // ============================================================================

  /**
   * Exchange a public token for an access token
   * Creates a new Plaid item (connection to a financial institution) for the user
   * @param publicToken - The public token obtained from Plaid Link
   * @returns The access token and item ID from the exchange
   */
  async exchangePublicToken(publicToken: string) {
    const request: ItemPublicTokenExchangeRequest = {
      public_token: publicToken,
    };

    try {
      const response = await this.plaid.itemPublicTokenExchange(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  /**
   * Get a Plaid item by access token
   * @param accessToken - The access token obtained from the public token exchange
   * @returns The item from Plaid
   */
  async getItem(accessToken: string) {
    const request: ItemGetRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.plaid.itemGet(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Institution Management
  // ============================================================================

  /**
   * Get institution details by ID
   * @param institutionId - The Plaid institution ID
   * @returns Institution details with optional metadata
   */
  async getInstitutionById(institutionId: string) {
    const request: InstitutionsGetByIdRequest = {
      institution_id: institutionId,
      country_codes: [CountryCode.Ca],
      options: {
        include_optional_metadata: true,
      },
    };

    try {
      const response = await this.plaid.institutionsGetById(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Account Management
  // ============================================================================

  /**
   * Get accounts for a Plaid item
   * @param accessToken - The access token for the item
   * @returns The accounts from Plaid
   */
  async getAccounts(accessToken: string) {
    const request: AccountsGetRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.plaid.accountsGet(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Transaction Management
  // ============================================================================

  /**
   * Sync transactions for a Plaid item
   * Handles pagination automatically and returns all transactions
   * @param accessToken - The access token for the item
   * @param cursor - Optional cursor for incremental updates (null for initial sync)
   * @returns Object containing added, modified, removed transactions and next cursor
   */
  async transactionsSync(accessToken: string, cursor: string | null = null) {
    const allAdded: any[] = [];
    const allModified: any[] = [];
    const allRemoved: any[] = [];
    let nextCursor: string | null = cursor;
    let originalCursor: string | null = cursor; // Track original cursor for pagination restarts

    try {
      // Pagination loop - continue until has_more is false
      while (true) {
        const request: TransactionsSyncRequest = {
          access_token: accessToken,
          cursor: nextCursor ?? undefined,
        };

        const response = await this.plaid.transactionsSync(request);
        const { added, modified, removed, has_more, next_cursor } =
          response.data;

        // Accumulate transactions
        allAdded.push(...(added || []));
        allModified.push(...(modified || []));
        allRemoved.push(...(removed || []));

        // If this is the first page and has_more is true, track the original cursor
        if (originalCursor === null && has_more && next_cursor) {
          originalCursor = next_cursor;
        }

        // Update next cursor
        nextCursor = next_cursor ?? null;

        // If no more pages, break
        if (!has_more) {
          break;
        }
      }

      return {
        added: allAdded,
        modified: allModified,
        removed: allRemoved,
        nextCursor,
      };
    } catch (error) {
      // If pagination fails, Plaid docs say to restart from original cursor
      // But for now, we'll just throw the error and let the caller handle retry logic
      throw handlePlaidError(error);
    }
  }

  /**
   * Refresh transactions for a Plaid item
   * Triggers an on-demand extraction to fetch the newest transactions
   * Note: This endpoint may take 10-30 seconds to complete
   * After refresh, Plaid will fire SYNC_UPDATES_AVAILABLE webhook
   * @param accessToken - The access token for the item
   * @returns Plaid refresh response
   */
  async transactionsRefresh(accessToken: string) {
    try {
      const request: TransactionsRefreshRequest = {
        access_token: accessToken,
      };

      const response = await this.plaid.transactionsRefresh(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }
}

// Export singleton instance
export const plaidService = new PlaidService(plaidClient);
