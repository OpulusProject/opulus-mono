import { Prisma, PrismaClient } from "@prisma/client";
import type {
  CreditCardLiability,
  LiabilitiesObject,
  MortgageLiability,
  StudentLoan,
} from "plaid";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";

type LiabilityDetails = Record<string, string | number | boolean | null>;

/** A liability ready to upsert, keyed by Plaid's account id. */
export interface NormalizedLiability {
  providerAccountId: string;
  data: Omit<
    Prisma.AccountLiabilityUncheckedCreateInput,
    "accountId" | "itemId" | "userId" | "syncedAt"
  >;
}

const toDate = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

function normalizeCredit(
  credit: CreditCardLiability
): NormalizedLiability | null {
  if (!credit.account_id) return null;
  return {
    providerAccountId: credit.account_id,
    data: {
      kind: "credit",
      isOverdue: credit.is_overdue ?? null,
      nextPaymentDueDate: toDate(credit.next_payment_due_date),
      minimumPayment: credit.minimum_payment_amount ?? null,
      lastPaymentAmount: credit.last_payment_amount ?? null,
      lastPaymentDate: toDate(credit.last_payment_date),
      lastStatementBalance: credit.last_statement_balance ?? null,
      lastStatementIssueDate: toDate(credit.last_statement_issue_date),
      aprs: credit.aprs.map((apr) => ({
        type: apr.apr_type,
        percentage: apr.apr_percentage,
        balanceSubjectToApr: apr.balance_subject_to_apr ?? null,
        interestChargeAmount: apr.interest_charge_amount ?? null,
      })),
    },
  };
}

function normalizeMortgage(mortgage: MortgageLiability): NormalizedLiability {
  const details: LiabilityDetails = {
    interestRateType: mortgage.interest_rate?.type ?? null,
    loanTypeDescription: mortgage.loan_type_description ?? null,
    loanTerm: mortgage.loan_term ?? null,
    escrowBalance: mortgage.escrow_balance ?? null,
    hasPmi: mortgage.has_pmi ?? null,
    hasPrepaymentPenalty: mortgage.has_prepayment_penalty ?? null,
    currentLateFee: mortgage.current_late_fee ?? null,
    pastDueAmount: mortgage.past_due_amount ?? null,
    ytdInterestPaid: mortgage.ytd_interest_paid ?? null,
    ytdPrincipalPaid: mortgage.ytd_principal_paid ?? null,
  };

  return {
    providerAccountId: mortgage.account_id,
    data: {
      kind: "mortgage",
      isOverdue:
        mortgage.past_due_amount != null ? mortgage.past_due_amount > 0 : null,
      nextPaymentDueDate: toDate(mortgage.next_payment_due_date),
      minimumPayment: mortgage.next_monthly_payment ?? null,
      lastPaymentAmount: mortgage.last_payment_amount ?? null,
      lastPaymentDate: toDate(mortgage.last_payment_date),
      interestRate: mortgage.interest_rate?.percentage ?? null,
      originationDate: toDate(mortgage.origination_date),
      originationPrincipal: mortgage.origination_principal_amount ?? null,
      maturityDate: toDate(mortgage.maturity_date),
      details,
    },
  };
}

function normalizeStudent(student: StudentLoan): NormalizedLiability | null {
  if (!student.account_id) return null;

  const details: LiabilityDetails = {
    loanName: student.loan_name ?? null,
    outstandingInterestAmount: student.outstanding_interest_amount ?? null,
    repaymentPlanType: student.repayment_plan?.type ?? null,
    repaymentPlanDescription: student.repayment_plan?.description ?? null,
    loanStatusType: student.loan_status?.type ?? null,
    loanStatusEndDate: student.loan_status?.end_date ?? null,
    ytdInterestPaid: student.ytd_interest_paid ?? null,
    ytdPrincipalPaid: student.ytd_principal_paid ?? null,
  };

  return {
    providerAccountId: student.account_id,
    data: {
      kind: "student",
      isOverdue: student.is_overdue ?? null,
      nextPaymentDueDate: toDate(student.next_payment_due_date),
      minimumPayment: student.minimum_payment_amount ?? null,
      lastPaymentAmount: student.last_payment_amount ?? null,
      lastPaymentDate: toDate(student.last_payment_date),
      lastStatementIssueDate: toDate(student.last_statement_issue_date),
      interestRate: student.interest_rate_percentage ?? null,
      originationDate: toDate(student.origination_date),
      originationPrincipal: student.origination_principal_amount ?? null,
      maturityDate: toDate(student.expected_payoff_date),
      details,
    },
  };
}

/**
 * Normalize Plaid's liabilities into one row per account.
 * Intentionally drops account numbers, property and servicer addresses, and
 * payment reference numbers: they are not needed to show a liability and are
 * sensitive to store.
 */
export function normalizePlaidLiabilities(
  liabilities: LiabilitiesObject
): NormalizedLiability[] {
  const normalized: Array<NormalizedLiability | null> = [
    ...(liabilities.credit ?? []).map(normalizeCredit),
    ...(liabilities.mortgage ?? []).map(normalizeMortgage),
    ...(liabilities.student ?? []).map(normalizeStudent),
  ];
  return normalized.filter(
    (item): item is NormalizedLiability => item !== null
  );
}

/**
 * Service for storing liabilities (APRs, payment due dates, loan terms)
 */
class LiabilityService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Insert or update the liabilities of some of an item's accounts, one row per
   * account, all stamped with the same sync time.
   * @param item - The item (and user) the liabilities belong to
   * @param rows - The liability data for each of our account ids
   * @throws AppError if database error occurs
   */
  async upsertMany(
    item: { id: string; userId: string },
    rows: Array<{ accountId: string; data: NormalizedLiability["data"] }>
  ): Promise<void> {
    const syncedAt = new Date();

    try {
      await this.prisma.$transaction(
        rows.map(({ accountId, data }) =>
          this.prisma.accountLiability.upsert({
            where: { accountId },
            create: {
              ...data,
              accountId,
              itemId: item.id,
              userId: item.userId,
              syncedAt,
            },
            update: { ...data, syncedAt },
          })
        )
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to store liabilities: ${error.message}`
          : "An unexpected error occurred while storing liabilities";
      throw new AppError(message, 500);
    }
  }
}

// Export singleton instance
export const liabilityService = new LiabilityService(prisma);
