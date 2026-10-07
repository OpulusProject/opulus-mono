/**
 * Get Items endpoint DTOs
 */

import { z } from "zod";

import { AccountDTOSchema, toAccountDTO } from "../accounts/account.js";
import { IsoTimestampSchema, toIsoString } from "../common.js";

/**
 * Item (a connection to an institution) as returned by the API
 * Only includes fields safe to expose to the client
 */
export const ItemDTOSchema = z.object({
  id: z.string(),
  institutionName: z.string().nullable(),
  institutionLogo: z.string().nullable(),
  institutionColor: z.string().nullable(),
  errorType: z.string().nullable(), // Plaid's error type, e.g. "ITEM_ERROR"
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  displayMessage: z.string().nullable(),
  // Plaid found accounts the user has not shared yet; they can add them.
  newAccountsAvailable: z.boolean(),
  syncedAt: IsoTimestampSchema.nullable(),
  accounts: z.array(AccountDTOSchema),
});

export type ItemDTO = z.infer<typeof ItemDTOSchema>;

/**
 * Items API response
 */
export const ItemsResponseSchema = z.object({
  data: z.object({
    items: z.array(ItemDTOSchema),
  }),
});

export type ItemsResponse = z.infer<typeof ItemsResponseSchema>;

/**
 * Transform full item data to public DTO
 * Filters out sensitive fields like accessToken, plaidItemId, etc.
 * @param item - Full item data from service (includes accounts)
 * @returns Public DTO with only safe-to-expose fields
 */
export function toItemDTO(item: {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  errorType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  displayMessage: string | null;
  newAccountsAvailable: boolean;
  syncedAt: Date | null;
  accounts: Array<Parameters<typeof toAccountDTO>[0]>;
}): ItemDTO {
  return {
    id: item.id,
    institutionName: item.institutionName,
    institutionLogo: item.institutionLogo,
    institutionColor: item.institutionColor,
    errorType: item.errorType,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage,
    displayMessage: item.displayMessage,
    newAccountsAvailable: item.newAccountsAvailable,
    syncedAt: toIsoString(item.syncedAt),
    accounts: item.accounts.map(toAccountDTO),
  };
}
