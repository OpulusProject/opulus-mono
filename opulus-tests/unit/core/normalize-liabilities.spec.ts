import { expect, test } from "@playwright/test";
import { normalizePlaidLiabilities } from "@opulus/core";

type Liabilities = Parameters<typeof normalizePlaidLiabilities>[0];
/** Plaid's liabilities, with only the fields a test gives (the SDK types require dozens). */
const plaid = (value: unknown) => value as Liabilities;

/**
 * Plaid's liabilities as we keep them (opulus-core/src/repositories/liabilityRepository.ts):
 * one row per account, only what the API shows, and none of the account numbers,
 * addresses and payment references Plaid also sends.
 *
 * Test cases:
 * - a credit card keeps its payment dates and amounts and each APR, with nulls for what Plaid left out
 * - a mortgage keeps its terms, is overdue only when something is past due, and puts the extras in details
 * - a student loan keeps its terms and puts the plan and status in details
 * - never keeps account numbers, addresses or payment references
 * - skips a credit card or student loan without an account id
 * - gives credit cards first, then mortgages, then student loans; and nothing for no liabilities
 */
test.describe("normalizePlaidLiabilities", () => {
  test("a credit card keeps its payment dates and amounts and each APR, with nulls for what Plaid left out", () => {
    const [row] = normalizePlaidLiabilities(
      plaid({
        credit: [
          {
            account_id: "card",
            aprs: [
              { apr_type: "purchase_apr", apr_percentage: 19.99, balance_subject_to_apr: 900, interest_charge_amount: 15 },
              { apr_type: "cash_apr", apr_percentage: 24.99 },
            ],
            is_overdue: false,
            minimum_payment_amount: 25,
            next_payment_due_date: "2026-10-25",
          },
        ],
      }),
    );

    expect(row).toEqual({
      providerAccountId: "card",
      data: {
        kind: "credit",
        isOverdue: false,
        nextPaymentDueDate: new Date("2026-10-25"),
        minimumPayment: 25,
        lastPaymentAmount: null,
        lastPaymentDate: null,
        lastStatementBalance: null,
        lastStatementIssueDate: null,
        aprs: [
          { type: "purchase_apr", percentage: 19.99, balanceSubjectToApr: 900, interestChargeAmount: 15 },
          { type: "cash_apr", percentage: 24.99, balanceSubjectToApr: null, interestChargeAmount: null },
        ],
      },
    });
  });

  test("a mortgage keeps its terms, is overdue only when something is past due, and puts the extras in details", () => {
    const mortgage = (past_due_amount: number | null | undefined) =>
      normalizePlaidLiabilities(
        plaid({
          mortgage: [
            {
              account_id: "home",
              interest_rate: { percentage: 3.99, type: "fixed" },
              next_monthly_payment: 1500,
              origination_date: "2016-01-01",
              origination_principal_amount: 425000,
              maturity_date: "2046-01-01",
              loan_term: "30 year",
              past_due_amount,
              escrow_balance: 3200,
              has_pmi: false,
            },
          ],
        }),
      )[0]!;

    const current = mortgage(0);
    expect(current.data).toMatchObject({
      kind: "mortgage",
      isOverdue: false,
      minimumPayment: 1500,
      interestRate: 3.99,
      originationDate: new Date("2016-01-01"),
      originationPrincipal: 425000,
      maturityDate: new Date("2046-01-01"),
    });
    expect(current.data.details).toMatchObject({ interestRateType: "fixed", loanTerm: "30 year", escrowBalance: 3200, hasPmi: false, currentLateFee: null });
    expect(mortgage(120.5).data.isOverdue).toBe(true);
    expect(mortgage(null).data.isOverdue).toBeNull();
    expect(mortgage(undefined).data.isOverdue).toBeNull();
  });

  test("a student loan keeps its terms and puts the plan and status in details", () => {
    const [row] = normalizePlaidLiabilities(
      plaid({
        student: [
          {
            account_id: "loan",
            is_overdue: true,
            minimum_payment_amount: 138.05,
            interest_rate_percentage: 5.25,
            expected_payoff_date: "2032-01-01",
            loan_name: "Consolidation",
            repayment_plan: { type: "standard", description: "Standard" },
            loan_status: { type: "repayment", end_date: "2030-01-01" },
          },
        ],
      }),
    );

    expect(row!.data).toMatchObject({
      kind: "student",
      isOverdue: true,
      minimumPayment: 138.05,
      interestRate: 5.25,
      maturityDate: new Date("2032-01-01"),
    });
    expect(row!.data.details).toMatchObject({
      loanName: "Consolidation",
      repaymentPlanType: "standard",
      repaymentPlanDescription: "Standard",
      loanStatusType: "repayment",
      loanStatusEndDate: "2030-01-01",
      ytdInterestPaid: null,
    });
  });

  test("never keeps account numbers, addresses or payment references", () => {
    const rows = normalizePlaidLiabilities(
      plaid({
        credit: [{ account_id: "card", aprs: [], account_number: "4111111111111111" }],
        mortgage: [
          {
            account_id: "home",
            account_number: "000123",
            property_address: { street: "1 Main St", city: "Town" },
            servicer_address: { street: "2 Bank Rd" },
          },
        ],
        student: [{ account_id: "loan", account_number: "9988", guarantor: "Some Agency", pslf_status: {}, servicer_address: { street: "3 Loan Ln" }, payment_reference_number: "ref-1" }],
      }),
    );

    const stored = JSON.stringify(rows);
    for (const secret of ["4111111111111111", "000123", "9988", "1 Main St", "2 Bank Rd", "3 Loan Ln", "ref-1", "Some Agency"]) {
      expect(stored).not.toContain(secret);
    }
  });

  test("skips a credit card or student loan without an account id", () => {
    const rows = normalizePlaidLiabilities(
      plaid({ credit: [{ account_id: null, aprs: [] }, { account_id: "card", aprs: [] }], student: [{ account_id: null }, { account_id: "loan" }] }),
    );

    expect(rows.map((r) => r.providerAccountId)).toEqual(["card", "loan"]);
  });

  test("gives credit cards first, then mortgages, then student loans; and nothing for no liabilities", () => {
    const rows = normalizePlaidLiabilities(plaid({ student: [{ account_id: "s" }], mortgage: [{ account_id: "m" }], credit: [{ account_id: "c", aprs: [] }] }));

    expect(rows.map((r) => r.data.kind)).toEqual(["credit", "mortgage", "student"]);
    expect(normalizePlaidLiabilities(plaid({}))).toEqual([]);
    expect(normalizePlaidLiabilities(plaid({ credit: null, mortgage: null, student: null }))).toEqual([]);
  });
});
