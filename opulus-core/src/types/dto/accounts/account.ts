import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  availableCreditOf,
  creditLimitOf,
  normalizeAccountType,
} from "../../../utils/accounts.js";
import { toNumber } from "../common.js";
import { AccountTypeSchema } from "./accountType.js";
import {
  LiabilityDetailsDTOSchema,
  toLiabilityDetailsDTO,
} from "./liabilityDetails.js";

/**
 * Account (nested in an item, and returned by the accounts endpoint)
 */
export const AccountDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  officialName: z.string().nullable(), // Name the institution uses for the account
  type: AccountTypeSchema, // Plaid's type, normalized: brokerage is "investment", unknown is "other"
  subtype: z.string().nullable(), // e.g., "checking", "savings", "credit card", etc.
  mask: z.string().nullable(), // Last 2-4 alphanumeric characters of the account number
  balanceAvailable: z.number().nullable(),
  balanceCurrent: z.number().nullable(),
  balanceLimit: z.number().nullable(), // Credit limit as Plaid reports it (for credit accounts)
  creditLimit: z.number().nullable(), // Credit accounts only: the limit, derived from the available credit when Plaid sent only that
  availableCredit: z.number().nullable(), // Credit accounts only: the credit still available, derived from the limit when Plaid sent only that
  isoCurrencyCode: z.string().nullable(), // ISO 4217 currency code (e.g., "USD", "CAD")
  liabilityDetails: LiabilityDetailsDTOSchema.nullable(), // Credit/loan details, when available
});

export type AccountDTO = z.infer<typeof AccountDTOSchema>;

/**
 * Transform a stored account row to its public DTO
 */
export function toAccountDTO(account: {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  balanceAvailable: Prisma.Decimal | null;
  balanceCurrent: Prisma.Decimal | null;
  balanceLimit: Prisma.Decimal | null;
  isoCurrencyCode: string | null;
  liabilityDetails: Parameters<typeof toLiabilityDetailsDTO>[0] | null;
}): AccountDTO {
  const type = normalizeAccountType(account.type);
  const balances = {
    balanceLimit: toNumber(account.balanceLimit),
    balanceAvailable: toNumber(account.balanceAvailable),
    balanceCurrent: toNumber(account.balanceCurrent),
  };
  return {
    id: account.id,
    name: account.name,
    officialName: account.officialName,
    type,
    subtype: account.subtype,
    mask: account.mask,
    ...balances,
    creditLimit: type === "credit" ? creditLimitOf(balances) : null,
    availableCredit: type === "credit" ? availableCreditOf(balances) : null,
    isoCurrencyCode: account.isoCurrencyCode,
    liabilityDetails: account.liabilityDetails
      ? toLiabilityDetailsDTO(account.liabilityDetails)
      : null,
  };
}
