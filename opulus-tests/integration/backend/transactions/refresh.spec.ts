import { expect, test } from "@playwright/test";
import { RefreshTransactionsResponseSchema } from "@opulus/core";

import { expectOk, expectStatus, expectMatchesSchema } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { testDb } from "../../../shared/db.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  createSandboxItem,
  requireSandboxCredentials,
} from "../../helpers/plaidSandbox.js";

/**
 * POST /api/transactions/refresh — Plaid Sandbox round-trip.
 *
 * The service suite covers 401 + 400 validation. Here we create a real
 * sandbox item and trigger an on-demand refresh through Plaid. The endpoint
 * returns 200 with a request_id as soon as Plaid accepts the refresh (the
 * actual data arrives later via a SYNC_UPDATES_AVAILABLE webhook, which is
 * out of scope for this suite).
 *
 * NOTE: this route accepts the external `plaidItemId` (Plaid's `item_id`), not
 * our internal id. That field is intentionally not exposed on GET /api/items
 * (ItemPublicDTO strips it), so we read it from the test DB — the suite is
 * already permitted to seed via testDb(); reading one derived field for test
 * setup is in-scope.
 */
test.describe("POST /api/transactions/refresh (sandbox)", () => {
  test("accepts an on-demand refresh for an item the user owns", async ({
    request,
  }) => {
    // Arrange: authenticated user + one real sandbox item they own; look up
    // the external plaidItemId that this endpoint takes.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);
    const persisted = await testDb().item.findUniqueOrThrow({
      where: { id: itemId },
      select: { plaidItemId: true },
    });

    // Act
    const res = await request.post("/api/transactions/refresh", {
      headers: withSession(cookie),
      data: { itemId: persisted.plaidItemId },
    });

    // Assert: Plaid accepted the refresh and returned a request_id.
    await expectOk(res);
    await expectMatchesSchema(res, RefreshTransactionsResponseSchema);
    const body = (await res.json()) as {
      data: { requestId: string; message: string };
    };
    expect(typeof body.data.requestId).toBe("string");
    expect(body.data.requestId.length).toBeGreaterThan(0);
  });

  test("rejects an item owned by a different user (401)", async ({ request }) => {
    // Arrange: one real sandbox item owned by `owner`; `intruder` tries to use it.
    const creds = requireSandboxCredentials();
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, owner.cookie, creds);
    const persisted = await testDb().item.findUniqueOrThrow({
      where: { id: itemId },
      select: { plaidItemId: true },
    });

    // Act
    const res = await request.post("/api/transactions/refresh", {
      headers: withSession(intruder.cookie),
      data: { itemId: persisted.plaidItemId },
    });

    // Assert
    await expectStatus(res, 401);
  });
});
