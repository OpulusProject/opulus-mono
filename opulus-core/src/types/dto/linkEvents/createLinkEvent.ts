/**
 * Link Event endpoint DTOs
 */

import { z } from "zod";

/**
 * How the Link session was started: a new connection, or update mode for an
 * existing one (`reconnect` repairs it, `add-accounts` shares new accounts).
 */
export const LinkSessionModeSchema = z.enum([
  "new",
  "reconnect",
  "add-accounts",
]);

export type LinkSessionMode = z.infer<typeof LinkSessionModeSchema>;

/**
 * A Plaid Link event reported by the frontend, so it can be logged where we
 * can see it. The ids are what Plaid support asks for when a connection fails.
 */
export const CreateLinkEventRequestSchema = z.object({
  eventName: z.string().min(1, "eventName is required").max(64),
  mode: LinkSessionModeSchema,
  itemId: z.string().max(64).optional(), // our item id, for update mode
  linkSessionId: z.string().max(128).optional(),
  requestId: z.string().max(128).optional(), // Plaid's request id
  institutionId: z.string().max(64).optional(),
  institutionName: z.string().max(200).optional(),
  viewName: z.string().max(64).optional(),
  exitStatus: z.string().max(64).optional(),
  errorType: z.string().max(64).optional(),
  errorCode: z.string().max(64).optional(),
  errorMessage: z.string().max(500).optional(),
});

export type CreateLinkEventRequest = z.infer<
  typeof CreateLinkEventRequestSchema
>;
