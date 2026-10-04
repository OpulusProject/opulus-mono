import { test } from "@playwright/test";

import { expectStatus } from "../../shared/assertions.js";
import { withSession } from "../../shared/client.js";
import { createAuthedUser } from "../../shared/fixtures/auth.js";

/**
 * POST /api/plaid/items — service-owned boundaries only.
 *
 * The happy path exchanges a Plaid-issued public_token with the real Plaid API,
 * so it lives in the integration suite (backend-integration/plaid/items-create).
 * This file covers the deterministic boundary the service itself owns and can
 * answer without touching Plaid: authentication gating and request-body
 * validation.
 */
test.describe("POST /api/plaid/items", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/plaid/items", {
      data: {
        publicToken: "public-sandbox-does-not-matter",
        institutionId: "ins_109508",
      },
    });
    await expectStatus(res, 401);
  });

  test("rejects missing publicToken with a validation error (400)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.post("/api/plaid/items", {
      headers: withSession(cookie),
      data: { institutionId: "ins_109508" },
    });
    await expectStatus(res, 400);
  });

  test("rejects missing institutionId with a validation error (400)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.post("/api/plaid/items", {
      headers: withSession(cookie),
      data: { publicToken: "public-sandbox-does-not-matter" },
    });
    await expectStatus(res, 400);
  });
});
