import type { Prisma } from "@prisma/client";

import { toNumber } from "../common.js";
import {
  type LiabilityDetailsDTO,
  toLiabilityDetailsDTO,
} from "./liabilityDetails.js";

/**
 * Bank account (nested in an item, and returned by the bank accounts endpoint)
 */
export interface BankAccountDTO {
  id: string;
  name: string;
  officialName: string | null; // Name the institution uses for the account
  type: string; // e.g., "depository", "credit", "loan", "investment", etc.
  subtype: string | null; // e.g., "checking", "savings", "credit card", etc.
  mask: string | null; // Last 2-4 alphanumeric characters of the account number
  balanceAvailable: number | null;
  balanceCurrent: number | null;
  balanceLimit: number | null; // Credit limit (for credit accounts)
  isoCurrencyCode: string | null; // ISO 4217 currency code (e.g., "USD", "CAD")
  liabilityDetails: LiabilityDetailsDTO | null; // Credit/loan details, when available
}

/**
 * Transform a stored bank account row to its public DTO
 */
export function toBankAccountDTO(account: {
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
}): BankAccountDTO {
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
