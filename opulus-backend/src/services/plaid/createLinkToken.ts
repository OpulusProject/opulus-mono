import { CountryCode, LinkTokenCreateRequest, Products } from "plaid";
import { plaidClient } from "@/client/plaid.js";
import config from "@/config/default.js";
import { handlePlaidError } from "@/utils/plaidErrors.js";

/**
 * Create a Plaid Link token for the user
 * @param userToken - Plaid user token (from userCreate)
 * @param userId - User ID from your database
 * @returns Link token response from Plaid
 */
export async function createLinkToken(userToken: string, userId: string) {
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
    };

    const response = await plaidClient.linkTokenCreate(request);
    return response.data;
  } catch (error) {
    throw handlePlaidError(error);
  }
}

