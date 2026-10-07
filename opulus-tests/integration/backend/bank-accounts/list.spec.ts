import { expect, test } from "@playwright/test";

import { expectOk } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  createSandboxItem,
  requireSandboxCredentials,
} from "../helpers/plaidSandbox.js";

interface AccountRow {
  id: string;
  type: string;
  connection: { id: string };
  liabilityDetails: unknown;
}

const ACCOUNT_TYPES = ["depository", "investment", "credit", "loan", "other"];

/**
 * GET /api/bank-accounts — Plaid Sandbox round-trip.
 *
 * The default sandbox user has cash, investment, credit, and loan accounts, so
 * a freshly linked item exercises every type filter against real data.
 */
test.describe("GET /api/bank-accounts (sandbox)", () => {
  test("returns a linked item's accounts, filterable by type, each tied to its connection", async ({
    request,
  }) => {
    // Arrange: a real sandbox item linked through the backend.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);
    const list = async (query = "") => {
      const res = await request.get(`/api/bank-accounts${query}`, {
        headers: withSession(cookie),
      });
      await expectOk(res);
      return (await res.json()).data.accounts as AccountRow[];
    };

    // Act
    const all = await list();
    const byType = Object.fromEntries(
      await Promise.all(
        ACCOUNT_TYPES.map(async (type) => [type, await list(`?type=${type}`)]),
      ),
    ) as Record<string, AccountRow[]>;

    // Assert: every account belongs to the linked connection, each filter
    // returns only its own type, and the filters together cover every account.
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((a) => a.connection.id === itemId)).toBe(true);
    for (const type of ACCOUNT_TYPES) {
      expect(byType[type].every((a) => a.type === type)).toBe(true);
    }
    expect(byType.depository.length).toBeGreaterThan(0);
    expect(byType.credit.length).toBeGreaterThan(0);
    expect(
      ACCOUNT_TYPES.reduce((sum, type) => sum + byType[type].length, 0),
    ).toBe(all.length);

    // Plaid reports liabilities for credit cards, so at least one has details.
    expect(byType.credit.some((a) => a.liabilityDetails !== null)).toBe(true);
  });
});
