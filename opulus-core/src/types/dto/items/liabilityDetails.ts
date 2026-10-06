/**
 * Liability details for a credit or loan account (from Plaid liabilities).
 * Which fields are present depends on the account kind and what the
 * institution reports; anything missing is null.
 */

export type LiabilityKind = "credit" | "mortgage" | "student";

export interface LiabilityApr {
  type: string; // e.g. "purchase_apr", "cash_apr", "balance_transfer_apr"
  percentage: number;
  balanceSubjectToApr: number | null;
  interestChargeAmount: number | null;
}

export interface LiabilityDetailsDTO {
  kind: LiabilityKind;
  isOverdue: boolean | null;
  nextPaymentDueDate: string | null; // ISO date
  minimumPayment: number | null; // Mortgage: next monthly payment
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null; // ISO date
  lastStatementBalance: number | null;
  lastStatementIssueDate: string | null; // ISO date
  interestRate: number | null; // Percentage
  originationDate: string | null; // ISO date
  originationPrincipal: number | null;
  maturityDate: string | null; // Mortgage maturity or student loan expected payoff
  aprs: LiabilityApr[] | null;
  details: Record<string, string | number | boolean | null> | null;
  syncedAt: string; // ISO timestamp
}

const toNumber = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const toIso = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

/**
 * Transform a stored liability row to its public DTO
 */
export function toLiabilityDetailsDTO(row: {
  kind: string;
  isOverdue: boolean | null;
  nextPaymentDueDate: Date | null;
  minimumPayment: any; // Prisma Decimal
  lastPaymentAmount: any; // Prisma Decimal
  lastPaymentDate: Date | null;
  lastStatementBalance: any; // Prisma Decimal
  lastStatementIssueDate: Date | null;
  interestRate: any; // Prisma Decimal
  originationDate: Date | null;
  originationPrincipal: any; // Prisma Decimal
  maturityDate: Date | null;
  aprs: unknown;
  details: unknown;
  syncedAt: Date;
}): LiabilityDetailsDTO {
  return {
    kind: row.kind as LiabilityKind,
    isOverdue: row.isOverdue,
    nextPaymentDueDate: toIso(row.nextPaymentDueDate),
    minimumPayment: toNumber(row.minimumPayment),
    lastPaymentAmount: toNumber(row.lastPaymentAmount),
    lastPaymentDate: toIso(row.lastPaymentDate),
    lastStatementBalance: toNumber(row.lastStatementBalance),
    lastStatementIssueDate: toIso(row.lastStatementIssueDate),
    interestRate: toNumber(row.interestRate),
    originationDate: toIso(row.originationDate),
    originationPrincipal: toNumber(row.originationPrincipal),
    maturityDate: toIso(row.maturityDate),
    aprs: (row.aprs as LiabilityApr[] | null) ?? null,
    details:
      (row.details as Record<
        string,
        string | number | boolean | null
      > | null) ?? null,
    syncedAt: row.syncedAt.toISOString(),
  };
}
