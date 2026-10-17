import { expect, test } from "@playwright/test";
import { CreateItemResponseSchema } from "@opulus/core";

import {
  expectMatchesSchema,
  expectOk,
  expectStatus,
} from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  DEFAULT_SANDBOX_INSTITUTION_ID,
  createSandboxPublicToken,
  requireSandboxCredentials,
} from "../../helpers/plaidSandbox.js";

/**
 * POST /api/items — Plaid Sandbox round-trip: the one test that a real
 * Plaid-issued public_token is accepted (exchanged, and its item, institution
 * and accounts read) by the backend. What the service does with the result
 * (validation, the stored token, the duplicate short-circuit) is in the service
 * suite, against the stub: services/backend/items/create.spec.ts.
 */
test.describe("POST /api/items (sandbox)", () => {
  test("creates an item from a real sandbox public_token and surfaces it on GET /api/items", async ({
    request,
  }) => {
    // Arrange: authenticated user + a fresh sandbox public_token.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const publicToken = await createSandboxPublicToken(creds);

    // Act
    const createRes = await request.post("/api/items", {
      headers: withSession(cookie),
      data: {
        publicToken,
        institutionId: DEFAULT_SANDBOX_INSTITUTION_ID,
      },
    });

    // Assert: 201 + { itemId, duplicate: false }, then the item is visible
    // via GET /api/items with at least one linked account.
    await expectStatus(createRes, 201);
    await expectMatchesSchema(createRes, CreateItemResponseSchema);
    const createBody = (await createRes.json()) as {
      data: { itemId: string; duplicate: boolean };
    };
    expect(createBody.data.duplicate).toBe(false);
    expect(createBody.data.itemId).toMatch(/^[a-z0-9]+$/i);

    const listRes = await request.get("/api/items", {
      headers: withSession(cookie),
    });
    await expectOk(listRes);
    const items = (await listRes.json()).data.items as Array<{
      id: string;
      accounts: unknown[];
    }>;
    const created = items.find((i) => i.id === createBody.data.itemId);
    expect(created, "created item should appear in GET /api/items").toBeDefined();
    expect(created!.accounts.length).toBeGreaterThan(0);
  });
});
