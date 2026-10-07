/**
 * Update Item Accounts endpoint DTOs
 */

import { z } from "zod";

/**
 * Update item accounts API response
 * Counts of the accounts inserted, refreshed and removed (no longer shared)
 */
export const UpdateItemAccountsResponseSchema = z.object({
  data: z.object({
    itemId: z.string(),
    created: z.number().int(),
    updated: z.number().int(),
    removed: z.number().int(),
  }),
});

export type UpdateItemAccountsResponse = z.infer<
  typeof UpdateItemAccountsResponseSchema
>;
