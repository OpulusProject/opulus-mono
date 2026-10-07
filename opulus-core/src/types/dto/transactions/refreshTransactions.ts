/**
 * Refresh Transactions endpoint DTOs
 */

import { z } from "zod";

/**
 * Refresh transactions request body
 */
export const RefreshTransactionsRequestSchema = z.object({
  itemId: z.string().min(1, "itemId is required"),
});

export type RefreshTransactionsRequest = z.infer<
  typeof RefreshTransactionsRequestSchema
>;

/**
 * Refresh transactions API response
 * The refresh finishes later; Plaid fires a webhook when it does.
 */
export const RefreshTransactionsResponseSchema = z.object({
  data: z.object({
    requestId: z.string(),
    message: z.string(),
  }),
});

export type RefreshTransactionsResponse = z.infer<
  typeof RefreshTransactionsResponseSchema
>;
