import { CountryCode, LinkTokenCreateRequest, PlaidApi, Products, UserCreateRequest } from "plaid";
import plaidClient from "../client/plaid.js";
import config from "../config/default.js";
import { handlePlaidError } from "../utils/plaidErrors.js";

/**
 * Service for managing Plaid integrations
 * Handles Plaid user creation and link token generation
 */
class PlaidService {
  constructor(private plaid: PlaidApi) {}

  /**
   * Create a Plaid user
   * @param userId - User ID from your database
   * @returns Plaid user creation response
   */
  async createUser(userId: string) {
    try {
      const request: UserCreateRequest = {
        client_user_id: userId,
      };

      const response = await this.plaid.userCreate(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }

  /**
   * Create a Plaid Link token for the user
   * @param userToken - Plaid user token (from userCreate)
   * @param userId - User ID from your database
   * @returns Link token response from Plaid
   */
  async createLinkToken(userToken: string, userId: string) {
    try {
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
          webhook: `${config.plaidWebhookUrl}/api/plaid/webhook`,
        }),
      };

      const response = await this.plaid.linkTokenCreate(request);
      return response.data;
    } catch (error) {
      throw handlePlaidError(error);
    }
  }
}

// Export singleton instance
export const plaidService = new PlaidService(plaidClient);

