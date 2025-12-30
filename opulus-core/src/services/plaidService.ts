import {
  CountryCode,
  InstitutionsGetByIdRequest,
  ItemGetRequest,
  ItemPublicTokenExchangeRequest,
  LinkTokenCreateRequest,
  PlaidApi,
  Products,
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

    console.log(
      `[PLAID SERVICE] Creating link token with webhook: ${config.plaidWebhookUrl}`
    );

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
}

// Export singleton instance
export const plaidService = new PlaidService(plaidClient);
