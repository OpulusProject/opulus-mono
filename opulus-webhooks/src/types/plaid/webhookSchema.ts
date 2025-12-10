import { TypeOf, array, number, object, string } from "zod";

/**
 * Schema for Plaid webhook event body (used in Express validation)
 * Wraps the event in a body object for middleware validation
 */
export const WebhookSchema = object({
  body: object({
    webhook_type: string({
      required_error: "Webhook type is required",
    }),
    webhook_code: string({
      required_error: "Webhook code is required",
    }),
    item_id: string().optional(),
    environment: string().optional(),
    new_transactions: number().optional(),
    removed_transactions: array(string()).optional(),
    account_ids: array(string()).optional(),
    link_session_id: string().optional(),
    link_token: string().optional(),
    public_token: string().optional(),
    error: object({
      error_type: string(),
      error_code: string(),
      error_message: string(),
    }).optional(),
  }).passthrough(), // Allow additional fields (matches [key: string]: unknown)
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
  account_ids: array(string()).optional(),
  link_session_id: string().optional(),
  link_token: string().optional(),
  public_token: string().optional(),
  error: object({
    error_type: string(),
    error_code: string(),
    error_message: string(),
  }).optional(),
}).passthrough();

/**
 * TypeScript type inferred from Zod schema
 * Single source of truth for Plaid webhook event structure
 */
export type PlaidWebhookEvent = TypeOf<typeof PlaidWebhookEventSchema>;

/**
 * Type for Express request body validation
 */
export type WebhookInput = TypeOf<typeof WebhookSchema>["body"];

