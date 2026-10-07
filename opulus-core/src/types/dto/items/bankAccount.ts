import {
  type LiabilityDetailsDTO,
  toLiabilityDetailsDTO,
} from "./liabilityDetails.js";

/**
 * Account (nested in Item)
 */
export interface Account {
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
 * (converts Prisma decimals to numbers).
 */
export function toAccountDTO(account: {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  balanceAvailable: any; // Prisma Decimal
  balanceCurrent: any; // Prisma Decimal
  balanceLimit: any; // Prisma Decimal
  isoCurrencyCode: string | null;
  liabilityDetails: Parameters<typeof toLiabilityDetailsDTO>[0] | null;
}): Account {
  return {
    id: account.id,
    name: account.name,
    officialName: account.officialName,
    type: account.type,
    subtype: account.subtype,
    mask: account.mask,
    balanceAvailable: account.balanceAvailable
      ? Number(account.balanceAvailable)
      : null,
    balanceCurrent: account.balanceCurrent
      ? Number(account.balanceCurrent)
      : null,
    balanceLimit: account.balanceLimit ? Number(account.balanceLimit) : null,
    isoCurrencyCode: account.isoCurrencyCode,
    liabilityDetails: account.liabilityDetails
      ? toLiabilityDetailsDTO(account.liabilityDetails)
      : null,
  };
}
