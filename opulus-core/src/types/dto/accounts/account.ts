import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { toNumber } from "../common.js";
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
  type: z.string(), // e.g., "depository", "credit", "loan", "investment", etc.
  subtype: z.string().nullable(), // e.g., "checking", "savings", "credit card", etc.
  mask: z.string().nullable(), // Last 2-4 alphanumeric characters of the account number
  balanceAvailable: z.number().nullable(),
  balanceCurrent: z.number().nullable(),
  balanceLimit: z.number().nullable(), // Credit limit (for credit accounts)
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
  return {
    id: account.id,
    name: account.name,
    officialName: account.officialName,
    type: account.type,
    subtype: account.subtype,
    mask: account.mask,
    balanceAvailable: toNumber(account.balanceAvailable),
    balanceCurrent: toNumber(account.balanceCurrent),
    balanceLimit: toNumber(account.balanceLimit),
    isoCurrencyCode: account.isoCurrencyCode,
    liabilityDetails: account.liabilityDetails
      ? toLiabilityDetailsDTO(account.liabilityDetails)
      : null,
  };
}
