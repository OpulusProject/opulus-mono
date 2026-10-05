import type { AccountLiabilityDTO } from "./liability.js";

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
  liability: AccountLiabilityDTO | null; // Credit/loan details, when available
}
