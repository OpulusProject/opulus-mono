import { expect, test } from "@playwright/test";

import { expectOk } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import { requireSandboxCredentials } from "../helpers/plaidSandbox.js";

/**
 * POST /api/plaid/link-token — Plaid Sandbox round-trip.
 *
 * The 401 case lives in the service suite. Here we assert the happy path:
 * for an authenticated user, the backend provisions a Plaid user token
 * (persisted on first call), creates a Link token through Plaid, and
 * returns it. In the sandbox environment Plaid issues tokens with the
 * `link-sandbox-` prefix.
 */
test.describe("POST /api/plaid/link-token (sandbox)", () => {
  test("returns a Plaid-issued link token for an authenticated user", async ({
    request,
  }) => {
    requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);

    const res = await request.post("/api/plaid/link-token", {
      headers: withSession(cookie),
      data: {},
    });
    await expectOk(res);

    const body = (await res.json()) as { data: { linkToken: string } };
    expect(typeof body.data.linkToken).toBe("string");
    // Sandbox link tokens are prefixed `link-sandbox-...`; the prefix is a
    // stable Plaid-side contract and a quick regression guard against the
    // backend accidentally pointing at a non-sandbox environment.
    expect(body.data.linkToken).toMatch(/^link-sandbox-/);
  });

  test("issues distinct tokens for distinct users", async ({ request }) => {
    requireSandboxCredentials();
    const [a, b] = await Promise.all([
      createAuthedUser(request),
      createAuthedUser(request),
    ]);

    const [resA, resB] = await Promise.all([
      request.post("/api/plaid/link-token", { headers: withSession(a.cookie), data: {} }),
      request.post("/api/plaid/link-token", { headers: withSession(b.cookie), data: {} }),
    ]);
    await expectOk(resA);
    await expectOk(resB);
    const bodyA = (await resA.json()) as { data: { linkToken: string } };
    const bodyB = (await resB.json()) as { data: { linkToken: string } };
    expect(bodyA.data.linkToken).not.toBe(bodyB.data.linkToken);
  });
});
