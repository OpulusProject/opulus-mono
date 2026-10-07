/**
 * Create Item endpoint DTOs
 */

import { z } from "zod";

/**
 * Create item request body
 */
export const CreateItemRequestSchema = z.object({
  publicToken: z.string().min(1, "publicToken is required"),
  institutionId: z.string().min(1, "institutionId is required"),
});

export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;

/**
 * Create item API response. Sent with 201 for a new item, or 409 with a
 * message when the user is already connected to the institution (itemId is
 * then the existing item).
 */
export const CreateItemResponseSchema = z.object({
  data: z.object({
    itemId: z.string(),
    duplicate: z.boolean(),
  }),
  message: z.string().optional(),
});

export type CreateItemResponse = z.infer<typeof CreateItemResponseSchema>;
