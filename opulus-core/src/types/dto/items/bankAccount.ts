/**
 * Account (nested in Item)
 */
export interface Account {
  id: string;
  name: string;
  type: string; // e.g., "depository", "credit", "loan", "investment", etc.
  balanceAvailable: number | null;
  balanceCurrent: number | null;
}
