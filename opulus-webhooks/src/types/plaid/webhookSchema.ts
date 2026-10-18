import { TypeOf, array, number, object, record, string } from "zod";

/**
 * The error Plaid attaches to ITEM webhooks (and others). Plaid sends null or
 * omits it when there is no error.
 */
const itemError = object({
  error_type: string(),
  error_code: string(),
  error_message: string(),
  display_message: string().nullish(),
});

/**
 * Schema for the actual Plaid webhook event (without body wrapper)
 * Use this for type inference and direct event validation
 */
export const PlaidWebhookEventSchema = object({
  webhook_type: string(),
  webhook_code: string(),
  item_id: string().optional(),
  environment: string().optional(),
  new_transactions: number().optional(),
  removed_transactions: array(string()).optional(),
  new_investments_transactions: number().optional(),
  canceled_investments_transactions: number().optional(),
  new_holdings: number().optional(),
  updated_holdings: number().optional(),
  account_ids: array(string()).optional(),
  account_ids_with_new_liabilities: array(string()).optional(),
  account_ids_with_updated_liabilities: record(
    string(),
    array(string())
  ).optional(),
  link_session_id: string().optional(),
  link_token: string().optional(),
  public_token: string().optional(),
  error: itemError.nullish(),
  consent_expiration_time: string().optional(),
  disconnect_time: string().optional(),
  reason: string().optional(),
}).passthrough();

/**
 * TypeScript type inferred from Zod schema
 * Single source of truth for Plaid webhook event structure
 */
export type PlaidWebhookEvent = TypeOf<typeof PlaidWebhookEventSchema>;
