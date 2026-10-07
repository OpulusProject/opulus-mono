import { expect, test } from "@playwright/test";

import { expectOk } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import { requireSandboxCredentials } from "../helpers/plaidSandbox.js";

/**
 * GET /api/institutions — Plaid Sandbox round-trip.
 *
 * The 401 case lives in the service suite. Here we assert the backend
 * actually proxies Plaid: an authenticated caller gets a non-empty paginated
 * list with the expected shape. We intentionally do NOT assert on a specific
 * institution_id (the backend's getInstitutions passes a page/count so a
 * given sandbox institution may or may not appear in the first page).
 */
test.describe("GET /api/institutions (sandbox)", () => {
  test("returns a non-empty institutions list for an authenticated user", async ({
    request,
  }) => {
    // Arrange
    requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/institutions", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const body = (await res.json()) as {
      data: {
        institutions: Array<{ id: string; name: string }>;
        total: number;
        count: number;
      };
    };
    expect(body.data.institutions.length).toBeGreaterThan(0);
    expect(body.data.count).toBe(body.data.institutions.length);
    // Shape check against the InstitutionDTO contract.
    for (const inst of body.data.institutions) {
      expect(typeof inst.id).toBe("string");
      expect(typeof inst.name).toBe("string");
      expect(inst.name.length).toBeGreaterThan(0);
    }
  });
});
