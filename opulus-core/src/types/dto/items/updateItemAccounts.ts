/**
 * Update Item Accounts endpoint DTOs
 */

/**
 * Update item accounts API response
 * Counts of the accounts inserted and refreshed from Plaid
 */
export interface UpdateItemAccountsResponse {
  data: {
    itemId: string;
    created: number;
    updated: number;
  };
}
