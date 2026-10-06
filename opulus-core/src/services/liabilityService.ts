import { Prisma, PrismaClient } from "@prisma/client";
import type {
  CreditCardLiability,
  LiabilitiesObject,
  MortgageLiability,
  StudentLoan,
} from "plaid";
import prisma from "../client/prisma.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { plaidService } from "./plaidService.js";

/**
 * Plaid error codes meaning "this item has no liabilities data to give right
 * now" (unsupported institution, not consented, not ready, or no eligible
 * accounts). These are expected, so callers treat them as "unavailable".
 */
const UNAVAILABLE_ERROR_CODES = new Set([
  "PRODUCTS_NOT_SUPPORTED",
  "PRODUCT_NOT_READY",
  "ADDITIONAL_CONSENT_REQUIRED",
  "NO_LIABILITY_ACCOUNTS",
  "INVALID_PRODUCT",
]);

type LiabilityDetails = Record<string, string | number | boolean | null>;

/** A liability ready to upsert, keyed by Plaid's account id. */
export interface NormalizedLiability {
  providerAccountId: string;
  data: Omit<
    Prisma.AccountLiabilityUncheckedCreateInput,
    "accountId" | "itemId" | "userId" | "syncedAt"
  >;
}

export type SyncLiabilitiesResult =
  | { status: "synced"; synced: number; unmatched: number }
  | { status: "unavailable"; reason: string };

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
  constructor(
    private prisma: PrismaClient,
    private plaid: typeof plaidService
  ) {}

  /**
   * Fetch an item's liabilities from Plaid and upsert one row per account.
   * Resolves to `unavailable` when Plaid has nothing to give for this item
   * (unsupported institution, product not ready, etc.); other failures throw.
   * @param item - The item to sync
   * @param options.providerAccountIds - Only fetch these Plaid account IDs
   *   (e.g. the accounts a LIABILITIES webhook reported as changed)
   * @throws AppError if Plaid or the database fails unexpectedly
   */
  async syncForItem(
    item: {
      id: string;
      userId: string;
      accessToken: string;
    },
    options: { providerAccountIds?: string[] } = {}
  ): Promise<SyncLiabilitiesResult> {
    let response;
    try {
      response = await this.plaid.getLiabilities(
        item.accessToken,
        options.providerAccountIds
      );
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code &&
        UNAVAILABLE_ERROR_CODES.has(error.code)
      ) {
        return { status: "unavailable", reason: error.code };
      }
      throw error;
    }

    const normalized = normalizePlaidLiabilities(response.liabilities);
    if (normalized.length === 0) {
      return { status: "synced", synced: 0, unmatched: 0 };
    }

    try {
      const accounts = await this.prisma.bankAccount.findMany({
        where: {
          itemId: item.id,
          providerAccountId: {
            in: normalized.map((entry) => entry.providerAccountId),
          },
        },
        select: { id: true, providerAccountId: true },
      });
      const accountIds = new Map(
        accounts.map((account) => [account.providerAccountId, account.id])
      );

      const syncedAt = new Date();
      const rows = normalized.flatMap((entry) => {
        const accountId = accountIds.get(entry.providerAccountId);
        return accountId ? [{ accountId, data: entry.data }] : [];
      });

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

      return {
        status: "synced",
        synced: rows.length,
        unmatched: normalized.length - rows.length,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError(`Database error: ${error.message}`, 500, error.code);
      }

      const message =
        error instanceof Error
          ? `Failed to sync liabilities: ${error.message}`
          : "An unexpected error occurred while syncing liabilities";
      throw new AppError(message, 500);
    }
  }

  /**
   * Like `syncForItem`, but never throws. Use where liabilities are a bonus
   * and must not fail the surrounding flow (e.g. linking an institution).
   */
  async trySyncForItem(item: {
    id: string;
    userId: string;
    accessToken: string;
  }): Promise<SyncLiabilitiesResult | { status: "failed" }> {
    try {
      const result = await this.syncForItem(item);
      logger.info(
        { item_id: item.id, user_id: item.userId, ...result },
        "Liabilities sync finished"
      );
      return result;
    } catch (error) {
      logger.warn(
        {
          item_id: item.id,
          user_id: item.userId,
          error_message: error instanceof Error ? error.message : String(error),
        },
        "Liabilities sync failed (non-fatal)"
      );
      return { status: "failed" };
    }
  }
}

// Export singleton instance
export const liabilityService = new LiabilityService(prisma, plaidService);
