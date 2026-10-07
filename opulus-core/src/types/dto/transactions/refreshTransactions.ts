/**
 * Refresh Transactions endpoint DTOs
 */

/**
 * Refresh transactions request body
 */
export interface RefreshTransactionsRequest {
  itemId: string;
}

/**
 * Refresh transactions API response
 * The refresh finishes later; Plaid fires a webhook when it does.
 */
export interface RefreshTransactionsResponse {
  data: {
    requestId: string;
    message: string;
  };
}
