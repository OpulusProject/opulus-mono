import { expect, test } from "@playwright/test";

import { expectOk } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  DEFAULT_SANDBOX_INSTITUTION_ID,
  requireSandboxCredentials,
} from "../helpers/plaidSandbox.js";

/**
 * GET /api/plaid/institutions — Plaid Sandbox round-trip.
 *
 * The 401 case lives in the service suite. Here we assert the backend
 * actually proxies Plaid: an authenticated caller gets a non-empty list and
 * the default sandbox institution (`ins_109508`) is present.
 */
test.describe("GET /api/plaid/institutions (sandbox)", () => {
  test("returns a non-empty institutions list that includes the default sandbox institution", async ({
    request,
  }) => {
    requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);

    const res = await request.get("/api/plaid/institutions", {
      headers: withSession(cookie),
    });
    await expectOk(res);

    const body = (await res.json()) as {
      data: {
        institutions: Array<{ institution_id: string; name: string }>;
        total: number;
        count: number;
      };
    };
    expect(body.data.institutions.length).toBeGreaterThan(0);
    expect(body.data.count).toBe(body.data.institutions.length);
    const ids = body.data.institutions.map((i) => i.institution_id);
    expect(ids).toContain(DEFAULT_SANDBOX_INSTITUTION_ID);
  });
});
