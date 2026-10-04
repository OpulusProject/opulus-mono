/**
 * Link Token endpoint DTOs
 */

/**
 * Link token API response
 */
export interface LinkTokenResponse {
  data: {
    linkToken: string;
    /**
     * Plaid Hosted Link URL. Present when the backend enables hosted link mode
     * (default). Frontend navigates the user here to complete Link; Plaid
     * delivers the public_token via the ITEM_ADD_RESULT webhook.
     */
    hostedLinkUrl?: string;
  };
}

