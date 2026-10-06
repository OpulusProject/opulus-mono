import { expect, test } from "@playwright/test";

import { expectOk } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  createSandboxItem,
  requireSandboxCredentials,
} from "../helpers/plaidSandbox.js";

interface Liability {
  kind: "credit" | "mortgage" | "student";
  aprs: Array<{ type: string; percentage: number }> | null;
  interestRate: number | null;
  minimumPayment: number | null;
  nextPaymentDueDate: string | null;
  details: Record<string, unknown> | null;
  syncedAt: string;
}

/**
 * GET /api/items — Plaid Sandbox round-trip (liabilities).
 *
 * Linking an item makes the backend fetch Plaid liabilities and store them per
 * account. The default sandbox user has a credit card, a mortgage, and a
 * student loan, so each should come back with its kind's details. We assert
 * shape and kind, not Plaid's specific sandbox figures.
 */
test.describe("GET /api/items (sandbox)", () => {
  test("returns liability details for the credit, mortgage, and student accounts of a freshly linked item", async ({
    request,
  }) => {
    // Arrange: a real sandbox item linked through the backend.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);

    // Act
    const res = await request.get("/api/items", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const item = (
      (await res.json()).data.items as Array<{
        id: string;
        accounts: Array<{ type: string; liabilityDetails: Liability | null }>;
      }>
    ).find((i) => i.id === itemId);
    const liabilities = (item?.accounts ?? []).flatMap((a) =>
      a.liabilityDetails ? [a.liabilityDetails] : [],
    );
    const byKind = (kind: Liability["kind"]) =>
      liabilities.find((l) => l.kind === kind);

    const credit = byKind("credit");
    expect(credit?.aprs?.length).toBeGreaterThan(0);
    expect(credit?.aprs?.[0]).toMatchObject({
      type: expect.any(String),
      percentage: expect.any(Number),
    });

    const mortgage = byKind("mortgage");
    expect(typeof mortgage?.interestRate).toBe("number");
    expect(mortgage?.details).toBeTruthy();

    const student = byKind("student");
    expect(typeof student?.interestRate).toBe("number");
    expect(student?.details).toBeTruthy();

    // Only credit, mortgage, and student accounts carry liabilities; the rest
    // (checking, savings, auto loan, HELOC...) stay null.
    expect(
      (item?.accounts ?? [])
        .filter((a) => a.type === "depository")
        .every((a) => a.liabilityDetails === null),
    ).toBe(true);
    for (const liability of liabilities) {
      expect(Number.isNaN(Date.parse(liability.syncedAt))).toBe(false);
    }
  });
});
