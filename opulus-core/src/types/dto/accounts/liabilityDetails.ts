import type { Prisma } from "@prisma/client";

import { toIsoString, toNumber } from "../common.js";

/**
 * Liability details for a credit or loan account (from Plaid liabilities).
 * Which fields are present depends on the account kind and what the
 * institution reports; anything missing is null.
 */

export type LiabilityKind = "credit" | "mortgage" | "student";

export interface LiabilityAprDTO {
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
  aprs: LiabilityAprDTO[] | null;
  details: Record<string, string | number | boolean | null> | null;
  syncedAt: string; // ISO timestamp
}

/**
 * Transform a stored liability row to its public DTO
 */
export function toLiabilityDetailsDTO(row: {
  kind: string;
  isOverdue: boolean | null;
  nextPaymentDueDate: Date | null;
  minimumPayment: Prisma.Decimal | null;
  lastPaymentAmount: Prisma.Decimal | null;
  lastPaymentDate: Date | null;
  lastStatementBalance: Prisma.Decimal | null;
  lastStatementIssueDate: Date | null;
  interestRate: Prisma.Decimal | null;
  originationDate: Date | null;
  originationPrincipal: Prisma.Decimal | null;
  maturityDate: Date | null;
  aprs: unknown;
  details: unknown;
  syncedAt: Date;
}): LiabilityDetailsDTO {
  return {
    kind: row.kind as LiabilityKind,
    isOverdue: row.isOverdue,
    nextPaymentDueDate: toIsoString(row.nextPaymentDueDate),
    minimumPayment: toNumber(row.minimumPayment),
    lastPaymentAmount: toNumber(row.lastPaymentAmount),
    lastPaymentDate: toIsoString(row.lastPaymentDate),
    lastStatementBalance: toNumber(row.lastStatementBalance),
    lastStatementIssueDate: toIsoString(row.lastStatementIssueDate),
    interestRate: toNumber(row.interestRate),
    originationDate: toIsoString(row.originationDate),
    originationPrincipal: toNumber(row.originationPrincipal),
    maturityDate: toIsoString(row.maturityDate),
    aprs: (row.aprs as LiabilityAprDTO[] | null) ?? null,
    details:
      (row.details as Record<
        string,
        string | number | boolean | null
      > | null) ?? null,
    syncedAt: toIsoString(row.syncedAt),
  };
}
