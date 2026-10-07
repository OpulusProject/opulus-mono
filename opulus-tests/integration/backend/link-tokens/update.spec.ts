import { expect, test } from "@playwright/test";

import { expectOk, expectStatus } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  createSandboxItem,
  requireSandboxCredentials,
} from "../helpers/plaidSandbox.js";

/**
 * POST /api/link-tokens/update — Plaid Sandbox round-trip.
 *
 * The 401 case lives in the service suite. Here we create a real sandbox item
 * (via /api/items) and then mint an update-mode Link token for it. The
 * backend uses the item's access_token under the hood; a successful call
 * proves the Item was persisted correctly end-to-end.
 */
test.describe("POST /api/link-tokens/update (sandbox)", () => {
  test("returns an update-mode link token for an item the user owns", async ({
    request,
  }) => {
    // Arrange: authenticated user + one real sandbox item they own.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);

    // Act
    const res = await request.post("/api/link-tokens/update", {
      headers: withSession(cookie),
      data: { itemId },
    });

    // Assert
    await expectOk(res);
    const body = (await res.json()) as { data: { linkToken: string } };
    expect(body.data.linkToken).toMatch(/^link-sandbox-/);
  });

  test("returns an update-mode link token that lets the user add accounts", async ({
    request,
  }) => {
    // Arrange
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, cookie, creds);

    // Act: Plaid validates the account-selection setting when it mints the token.
    const res = await request.post("/api/link-tokens/update", {
      headers: withSession(cookie),
      data: { itemId, mode: "add-accounts" },
    });

    // Assert
    await expectOk(res);
    const body = (await res.json()) as { data: { linkToken: string } };
    expect(body.data.linkToken).toMatch(/^link-sandbox-/);
  });

  test("rejects an item owned by a different user (401)", async ({ request }) => {
    // Arrange: one real sandbox item owned by `owner`; `intruder` tries to use it.
    const creds = requireSandboxCredentials();
    const owner = await createAuthedUser(request);
    const intruder = await createAuthedUser(request);
    const { itemId } = await createSandboxItem(request, owner.cookie, creds);

    // Act
    const res = await request.post("/api/link-tokens/update", {
      headers: withSession(intruder.cookie),
      data: { itemId },
    });

    // Assert
    await expectStatus(res, 401);
  });
});
