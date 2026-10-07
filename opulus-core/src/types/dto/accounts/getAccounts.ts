/**
 * Get Accounts endpoint DTOs
 */

import { z } from "zod";

import { AccountDTOSchema, toAccountDTO } from "./account.js";

/**
 * Account types, matching Plaid's account `type`. `other` also covers any type
 * we do not recognize.
 */
export const ACCOUNT_TYPES = [
  "depository",
  "investment",
  "credit",
  "loan",
  "other",
] as const;

export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);

export type AccountType = z.infer<typeof AccountTypeSchema>;

/**
 * The connection (item) an account belongs to, just enough to say where it is
 * and whether that connection has a problem.
 */
export const AccountConnectionDTOSchema = z.object({
  id: z.string(),
  institutionName: z.string().nullable(),
  errorCode: z.string().nullable(),
});

export type AccountConnectionDTO = z.infer<typeof AccountConnectionDTOSchema>;

export const AccountWithConnectionDTOSchema = AccountDTOSchema.extend({
  connection: AccountConnectionDTOSchema,
});

export type AccountWithConnectionDTO = z.infer<
  typeof AccountWithConnectionDTOSchema
>;

/**
 * Accounts API response
 */
export const AccountsResponseSchema = z.object({
  data: z.object({
    accounts: z.array(AccountWithConnectionDTOSchema),
  }),
});

export type AccountsResponse = z.infer<typeof AccountsResponseSchema>;

/**
 * Transform a stored account row (with its item) to the public DTO
 */
export function toAccountWithConnectionDTO(
  account: Parameters<typeof toAccountDTO>[0] & {
    item: {
      id: string;
      institutionName: string | null;
      errorCode: string | null;
    };
  }
): AccountWithConnectionDTO {
  return {
    ...toAccountDTO(account),
    connection: {
      id: account.item.id,
      institutionName: account.item.institutionName,
      errorCode: account.item.errorCode,
    },
  };
}
