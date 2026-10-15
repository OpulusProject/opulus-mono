/**
 * Account types, matching Plaid's account `type`. `other` also covers any type
 * we do not recognize. A leaf module, so the account DTO and the rules in
 * `utils/accounts.ts` can both import it without a cycle.
 */

import { z } from "zod";

export const ACCOUNT_TYPES = [
  "depository",
  "investment",
  "credit",
  "loan",
  "other",
] as const;

export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);

export type AccountType = z.infer<typeof AccountTypeSchema>;
