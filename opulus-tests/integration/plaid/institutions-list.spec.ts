import { expect, test } from "@playwright/test";
import { withSession } from "../../backend/helpers/client.js";
import { createAuthedUser } from "../../backend/helpers/fixtures/auth.js";

/**
 * This file: GET /api/plaid/institutions against real Plaid Sandbox.
 *
 * The service proxies Plaid's institutions list. Auth gating is covered in the
 * service-api suite; here we assert the real happy path returns a non-empty list
 * of institutions in Plaid's actual response shape.
 */
test.describe("GET /api/plaid/institutions (Plaid Sandbox)", () => {
  test("returns a non-empty list of real institutions", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/plaid/institutions", {
      headers: withSession(cookie),
    });

    // Assert
    expect(res.ok()).toBeTruthy();
    const { data } = await res.json();
    expect(data.institutions.length).toBeGreaterThan(0);
    expect(data.institutions[0]).toEqual(
      expect.objectContaining({
        institution_id: expect.any(String),
        name: expect.any(String),
      }),
    );
    expect(data.count).toBe(data.institutions.length);
  });
});
