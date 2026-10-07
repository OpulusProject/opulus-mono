import type { LiabilityDetailsDTO } from "./liabilityDetails.js";

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
