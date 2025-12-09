/**
 * Plaid webhook event types
 * Based on Plaid webhook documentation
 */
export interface PlaidWebhookEvent {
  webhook_type: string;
  webhook_code: string;
  item_id?: string;
  environment?: string;
  new_transactions?: number;
  removed_transactions?: string[];
  account_ids?: string[];
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
  };
  [key: string]: unknown;
}
