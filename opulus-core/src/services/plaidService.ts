import {
  AccountsGetRequest,
  CountryCode,
  InstitutionsGetByIdRequest,
  InstitutionsGetRequest,
  ItemGetRequest,
  ItemPublicTokenExchangeRequest,
  ItemRemoveRequest,
  LiabilitiesGetRequest,
  LinkTokenCreateRequest,
  PlaidApi,
  Products,
  TransactionsRefreshRequest,
  TransactionsSyncRequest,
  UserCreateRequest,
} from "plaid";
import plaidClient from "../client/plaid.js";
import config from "../config/default.js";
import { getPlaidErrorCode, handlePlaidError } from "../utils/plaidErrors.js";

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
    // Liabilities (APRs, payment due dates, loan terms) is only extracted when
    // the institution supports it. Putting it in `products` would hide every
    // institution without support from Link, which matters in Canada where
    // coverage is limited. Plaid bills it per item, only where it applies.
    const requiredIfSupportedProducts: Products[] = [Products.Liabilities];
    const countryCodes: CountryCode[] = [CountryCode.Ca];

    const request: LinkTokenCreateRequest = {
      user_token: userToken,
      user: {
        client_user_id: userId,
      },
      client_name: "Opulus",
      products,
      required_if_supported_products: requiredIfSupportedProducts,
      country_codes: countryCodes,
      language: "en",
      transactions: {
        days_requested: 730,
      },
      ...(config.plaidWebhookUrl && {
        webhook: config.plaidWebhookUrl,
      }),
    };

    try {
      const response = await this.plaid.linkTokenCreate(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  /**
   * Create a Link token in update mode for an existing item.
   * Omits products; Plaid uses the access token to repair the item.
   * With `selectAccounts`, Link also lets the user choose which accounts to
   * share, which is how accounts that appeared since the item was linked get
   * added (not available for EU/UK institutions).
   * https://plaid.com/docs/link/update-mode/
   */
  async createUpdateLinkToken(
    accessToken: string,
    userId: string,
    options: { selectAccounts?: boolean } = {}
  ) {
    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: userId,
      },
      client_name: "Opulus",
      country_codes: [CountryCode.Ca],
      language: "en",
      access_token: accessToken,
      ...(options.selectAccounts && {
        update: { account_selection_enabled: true },
      }),
      ...(config.plaidWebhookUrl && {
        webhook: config.plaidWebhookUrl,
      }),
    };

    try {
      const response = await this.plaid.linkTokenCreate(request);
      return response.data;
    } catch (error) {
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

  /**
   * Remove a Plaid item by access token
   * Treats an item Plaid no longer knows about (e.g. the user disconnected it
   * directly through Plaid) as already removed
   * @param accessToken - The access token for the specified item
   * @returns Unique identifier for the request, or null if the item was already removed
   */
  async removeItem(accessToken: string) {
    const request: ItemRemoveRequest = {
      access_token: accessToken,
    };

    try {
      const response = await this.plaid.itemRemove(request);
      return response.data;
    } catch (error) {
      if (getPlaidErrorCode(error) === "ITEM_NOT_FOUND") {
        return null;
      }
      throw handlePlaidError(error);
    }
  }

  // ============================================================================
  // Liabilities
  // ============================================================================

  /**
   * Fetch liabilities (credit card, mortgage, and student loan details) for an item
   * @param accessToken - The access token for the item
   * @param accountIds - Optional Plaid account IDs to limit the response to
   * @returns Liabilities and the item's accounts
   */
  async getLiabilities(accessToken: string, accountIds?: string[]) {
    const request: LiabilitiesGetRequest = {
      access_token: accessToken,
      ...(accountIds?.length && { options: { account_ids: accountIds } }),
    };

    try {
      const response = await this.plaid.liabilitiesGet(request);
      return response.data;
    } catch (error) {
      // The SDK wraps Plaid's error body in an axios error. Unwrap it so the
      // resulting AppError carries Plaid's own error_code, which callers use to
      // tell "not available for this item" apart from real failures.
      const plaidBody = (error as { response?: { data?: unknown } } | null)
        ?.response?.data;
      throw handlePlaidError(plaidBody ?? error);
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

  /**
   * Get all institutions from Plaid
   * Supports pagination to retrieve all available institutions
   * @returns List of institutions with total count
   */
  async getInstitutions() {
    const request: InstitutionsGetRequest = {
      count: 500, // Plaid max is 500
      offset: 0,
      country_codes: [CountryCode.Ca],
      options: {
        include_optional_metadata: true,
      },
    };

    try {
      const response = await this.plaid.institutionsGet(request);
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
