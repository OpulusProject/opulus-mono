/**
 * Sync Recurring Transactions endpoint DTOs
 */

import { z } from "zod";

/** Sync recurring transactions request body */
export const SyncRecurringRequestSchema = z.object({
  /** Our item id (not Plaid's). */
  itemId: z.string().min(1, "itemId is required"),
});

export type SyncRecurringRequest = z.infer<typeof SyncRecurringRequestSchema>;

/**
 * What the sync found. `unavailable` means Plaid has no recurring transactions
 * to give this item yet (its transactions are still loading, or the institution
 * is not supported): nothing changed and nothing is wrong.
 */
export const SyncRecurringResponseSchema = z.object({
  data: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("synced"),
      /** Recurring payments and income stored (what the item has now). */
      streams: z.number().int(),
    }),
    z.object({
      status: z.literal("unavailable"),
      /** Plaid's reason, e.g. PRODUCT_NOT_READY. */
      reason: z.string(),
    }),
  ]),
});

export type SyncRecurringResponse = z.infer<typeof SyncRecurringResponseSchema>;
