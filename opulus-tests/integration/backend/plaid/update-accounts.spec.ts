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
 */
test.describe("POST /api/plaid/items/:id/update-accounts (sandbox)", () => {
  test("reconciles a persisted item's accounts against Plaid's current view", async ({
    request,
  }) => {
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);

    const res = await request.post(
      `/api/plaid/items/${itemId}/update-accounts`,
      { headers: withSession(cookie) },
    );
    await expectOk(res);

    const body = (await res.json()) as {
      data: Record<string, number>;
    };
    // We don't pin the exact shape (the service's reconcile result shape may
    // evolve), but the counts should be numeric and non-negative, and no new
    // accounts should have appeared since initial link.
    for (const [key, value] of Object.entries(body.data)) {
      expect(typeof value, `${key} should be numeric`).toBe("number");
      expect(value).toBeGreaterThanOrEqual(0);
    }
    if ("created" in body.data) {
      expect(body.data.created).toBe(0);
    }
  });

  test("rejects an item owned by a different user (401)", async ({ request }) => {
    const creds = requireSandboxCredentials();
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, owner.cookie, creds);

    const res = await request.post(
      `/api/plaid/items/${itemId}/update-accounts`,
      { headers: withSession(intruder.cookie) },
    );
    await expectStatus(res, 401);
  });
});
