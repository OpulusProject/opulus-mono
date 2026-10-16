/**
 * Sync Holdings endpoint DTOs
 */

import { z } from "zod";

/** Sync holdings request body */
export const SyncHoldingsRequestSchema = z.object({
  /** Our item id (not Plaid's). */
  itemId: z.string().min(1, "itemId is required"),
});

export type SyncHoldingsRequest = z.infer<typeof SyncHoldingsRequestSchema>;

/**
 * What the sync found. `unavailable` means the institution has no investment
 * data to give this item (not supported, not consented, no investment
 * accounts): nothing changed and nothing is wrong.
 */
export const SyncHoldingsResponseSchema = z.object({
  data: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("synced"),
      /** Holdings stored (what the item holds now). */
      holdings: z.number().int(),
      securities: z.number().int(),
    }),
    z.object({
      status: z.literal("unavailable"),
      /** Plaid's reason, e.g. PRODUCTS_NOT_SUPPORTED. */
      reason: z.string(),
    }),
  ]),
});

export type SyncHoldingsResponse = z.infer<typeof SyncHoldingsResponseSchema>;
