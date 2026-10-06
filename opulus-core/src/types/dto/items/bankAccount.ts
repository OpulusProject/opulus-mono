import type { LiabilityDetailsDTO } from "./liabilityDetails.js";

/**
 * Account (nested in Item)
 */
export interface Account {
  id: string;
  name: string;
  type: string; // e.g., "depository", "credit", "loan", "investment", etc.
  balanceAvailable: number | null;
  balanceCurrent: number | null;
  balanceLimit: number | null; // Credit limit (for credit accounts)
  liabilityDetails: LiabilityDetailsDTO | null; // Credit/loan details, when available
}
