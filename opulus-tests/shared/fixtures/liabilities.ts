import { testDb } from "../db.js";

/**
 * Liability fixtures.
 *
 * Liabilities have NO create endpoint: they are written by the backend after
 * linking and by the LIABILITIES webhook. So they are seeded directly into the
 * ISOLATED test DB (see helpers/db.ts) against an account created by
 * seedItemWithAccount. Verification happens over HTTP.
 */

export interface SeededCreditLiability {
  nextPaymentDueDate: Date;
  minimumPayment: number;
  lastStatementBalance: number;
  aprPercentage: number;
}

/**
 * Seed a credit card liability (one purchase APR) for a user's account.
 */
export async function seedCreditLiability(params: {
  userId: string;
  itemId: string;
  accountId: string;
  overrides?: Partial<SeededCreditLiability>;
}): Promise<SeededCreditLiability> {
  const seeded: SeededCreditLiability = {
    nextPaymentDueDate: new Date("2026-11-15T00:00:00.000Z"),
    minimumPayment: 35.5,
    lastStatementBalance: 410.25,
    aprPercentage: 19.99,
    ...params.overrides,
  };

  await testDb().accountLiability.create({
    data: {
      accountId: params.accountId,
      itemId: params.itemId,
      userId: params.userId,
      kind: "credit",
      isOverdue: false,
      nextPaymentDueDate: seeded.nextPaymentDueDate,
      minimumPayment: seeded.minimumPayment,
      lastStatementBalance: seeded.lastStatementBalance,
      aprs: [
        {
          type: "purchase_apr",
          percentage: seeded.aprPercentage,
          balanceSubjectToApr: 410.25,
          interestChargeAmount: 6.83,
        },
      ],
      syncedAt: new Date(),
    },
  });

  return seeded;
}
