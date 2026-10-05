import { expect, test } from "@playwright/test";

import { expectOk, expectStatus } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  createSandboxItem,
  requireSandboxCredentials,
} from "../helpers/plaidSandbox.js";

/**
 * POST /api/plaid/items/:id/update-accounts — Plaid Sandbox round-trip.
 *
 * No service-suite coverage exists for this route beyond what will be added
 * for 401. Here we create a real sandbox item and immediately re-sync its
 * accounts; since Plaid's view hasn't changed, we expect every account to be
 * reported as `updated` (or `unchanged`) and none as `created`.
 *
 * TODO: coverage gaps — both require seeding our DB out of sync with Plaid
 * (sandbox items are fixed on the Plaid side, so divergence has to come from
 * our side via testDb()):
 *   - "new accounts appear": delete one account row for the item post-link,
 *     re-sync, assert created === 1.
 *   - "accounts are unlinked": insert a bogus extra account row, re-sync,
 *     assert it's removed (or marked inactive, per whichever semantics the
 *     controller lands on).
 */
test.describe("POST /api/plaid/items/:id/update-accounts (sandbox)", () => {
  test("reconciles a persisted item's accounts against Plaid's current view", async ({
    request,
  }) => {
    // Arrange: authenticated user + one real sandbox item they own.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);

    // Act
    const res = await request.post(
      `/api/plaid/items/${itemId}/update-accounts`,
      { headers: withSession(cookie) },
    );

    // Assert: no new accounts should have appeared since the initial link;
    // every Plaid-reported account should map to the rows we just wrote.
    await expectOk(res);
    const body = (await res.json()) as {
      data: { itemId: string; created: number; updated: number };
    };
    expect(body.data.itemId).toBe(itemId);
    expect(body.data.created).toBe(0);
    expect(body.data.updated).toBeGreaterThan(0);
  });

  test("rejects an item owned by a different user (401)", async ({ request }) => {
    // Arrange: one real sandbox item owned by `owner`; `intruder` tries to use it.
    const creds = requireSandboxCredentials();
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, owner.cookie, creds);

    // Act
    const res = await request.post(
      `/api/plaid/items/${itemId}/update-accounts`,
      { headers: withSession(intruder.cookie) },
    );

    // Assert
    await expectStatus(res, 401);
  });
});
