import { expect, test } from "@playwright/test";
import { InstitutionsResponseSchema } from "@opulus/core";
import { expectMatchesSchema, expectOk } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/index.js";

/**
 * This file: the institutions list endpoint, which proxies Plaid's list (the
 * Plaid stub here): the shape of the list, not which institutions Plaid has.
 */
test.describe("GET /api/institutions", () => {
  test("returns the institutions Plaid lists, each with an id and a name", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/institutions", { headers: withSession(cookie) });

    // Assert
    await expectOk(res);
    const { data } = await expectMatchesSchema(res, InstitutionsResponseSchema);
    expect(data.institutions.length).toBeGreaterThan(0);
    expect(data.count).toBe(data.institutions.length);
    for (const institution of data.institutions) {
      expect(institution.id.length).toBeGreaterThan(0);
      expect(institution.name.length).toBeGreaterThan(0);
    }
  });
});
