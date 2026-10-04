import { expect, test } from "@playwright/test";

import { expectOk, expectStatus } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  createSandboxItem,
  requireSandboxCredentials,
} from "../helpers/plaidSandbox.js";

/**
 * POST /api/plaid/link-token/update — Plaid Sandbox round-trip.
 *
 * The 401 case lives in the service suite. Here we create a real sandbox item
 * (via /api/plaid/items) and then mint an update-mode Link token for it. The
 * backend uses the item's access_token under the hood; a successful call
 * proves the Item was persisted correctly end-to-end.
 */
test.describe("POST /api/plaid/link-token/update (sandbox)", () => {
  test("returns an update-mode link token for an item the user owns", async ({
    request,
  }) => {
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);

    const res = await request.post("/api/plaid/link-token/update", {
      headers: withSession(cookie),
      data: { itemId },
    });
    await expectOk(res);

    const body = (await res.json()) as { data: { linkToken: string } };
    expect(body.data.linkToken).toMatch(/^link-sandbox-/);
  });

  test("rejects an item owned by a different user (401)", async ({ request }) => {
    const creds = requireSandboxCredentials();
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, owner.cookie, creds);

    const res = await request.post("/api/plaid/link-token/update", {
      headers: withSession(intruder.cookie),
      data: { itemId },
    });
    await expectStatus(res, 401);
  });
});
