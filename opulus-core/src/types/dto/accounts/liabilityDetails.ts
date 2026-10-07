import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { IsoTimestampSchema, toIsoString, toNumber } from "../common.js";

/**
 * Liability details for a credit or loan account (from Plaid liabilities).
 * Which fields are present depends on the account kind and what the
 * institution reports; anything missing is null.
 */

export const LiabilityKindSchema = z.enum(["credit", "mortgage", "student"]);

export type LiabilityKind = z.infer<typeof LiabilityKindSchema>;

export const LiabilityAprDTOSchema = z.object({
  type: z.string(), // e.g. "purchase_apr", "cash_apr", "balance_transfer_apr"
  percentage: z.number(),
  balanceSubjectToApr: z.number().nullable(),
  interestChargeAmount: z.number().nullable(),
});

export type LiabilityAprDTO = z.infer<typeof LiabilityAprDTOSchema>;

export const LiabilityDetailsDTOSchema = z.object({
  kind: LiabilityKindSchema,
  isOverdue: z.boolean().nullable(),
  nextPaymentDueDate: IsoTimestampSchema.nullable(), // ISO date
  minimumPayment: z.number().nullable(), // Mortgage: next monthly payment
  lastPaymentAmount: z.number().nullable(),
  lastPaymentDate: IsoTimestampSchema.nullable(), // ISO date
  lastStatementBalance: z.number().nullable(),
  lastStatementIssueDate: IsoTimestampSchema.nullable(), // ISO date
  interestRate: z.number().nullable(), // Percentage
  originationDate: IsoTimestampSchema.nullable(), // ISO date
  originationPrincipal: z.number().nullable(),
  maturityDate: IsoTimestampSchema.nullable(), // Mortgage maturity or student loan expected payoff
  aprs: z.array(LiabilityAprDTOSchema).nullable(),
  details: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .nullable(),
  syncedAt: IsoTimestampSchema, // ISO timestamp
});

export type LiabilityDetailsDTO = z.infer<typeof LiabilityDetailsDTOSchema>;

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
