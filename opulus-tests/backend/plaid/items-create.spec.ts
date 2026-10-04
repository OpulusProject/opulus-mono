import { expect, test } from "@playwright/test";

import { expectOk, expectStatus } from "../helpers/assertions.js";
import { withSession } from "../helpers/client.js";
import { createAuthedUser } from "../helpers/fixtures/auth.js";
import {
  DEFAULT_SANDBOX_INSTITUTION_ID,
  createSandboxPublicToken,
  requireSandboxCredentials,
} from "../helpers/fixtures/plaidSandbox.js";

/**
 * POST /api/plaid/items — exchange a Plaid Link public_token for an access
 * token and persist the Item + its initial accounts. This is the primary
 * replacement for the deprecated ITEM_ADD_RESULT webhook creation path.
 *
 * The happy-path and duplicate-detection cases round-trip through Plaid's
 * real Sandbox API to mint public_tokens. They self-skip when
 * PLAID_SANDBOX_CLIENT_ID / PLAID_SANDBOX_SECRET are not configured, so the
 * default CI pipeline (which uses `ci-test` dummies) stays green.
 */
test.describe("POST /api/plaid/items", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/plaid/items", {
      data: {
        publicToken: "public-sandbox-does-not-matter",
        institutionId: DEFAULT_SANDBOX_INSTITUTION_ID,
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
      data: { institutionId: DEFAULT_SANDBOX_INSTITUTION_ID },
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

  test("creates an item from a real sandbox public_token and surfaces it on GET /api/items", async ({
    request,
  }) => {
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);
    const publicToken = await createSandboxPublicToken(creds);

    // Act
    const createRes = await request.post("/api/plaid/items", {
      headers: withSession(cookie),
      data: {
        publicToken,
        institutionId: DEFAULT_SANDBOX_INSTITUTION_ID,
      },
    });

    // Assert: 201 + { itemId, duplicate: false }
    await expectStatus(createRes, 201);
    const createBody = (await createRes.json()) as {
      data: { itemId: string; duplicate: boolean };
    };
    expect(createBody.data.duplicate).toBe(false);
    expect(createBody.data.itemId).toMatch(/^[a-z0-9]+$/i);

    // Verify over HTTP: the new item is now visible on the list endpoint
    // scoped to this user.
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

  test("short-circuits with 409 when the user already has an item for the same institution (no exchange of the second public_token)", async ({
    request,
  }) => {
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);

    // First link: should succeed.
    const firstToken = await createSandboxPublicToken(creds);
    const firstRes = await request.post("/api/plaid/items", {
      headers: withSession(cookie),
      data: {
        publicToken: firstToken,
        institutionId: DEFAULT_SANDBOX_INSTITUTION_ID,
      },
    });
    await expectStatus(firstRes, 201);
    const firstBody = (await firstRes.json()) as {
      data: { itemId: string; duplicate: boolean };
    };

    // Second link to the same institution: backend should detect the
    // duplicate *before* exchanging the public_token and short-circuit 409.
    // We generate a fresh token so that if the backend ever regresses and
    // calls /item/public_token/exchange, the exchange would actually succeed
    // (and this test would correctly fail by returning 201 instead of 409).
    const secondToken = await createSandboxPublicToken(creds);
    const dupeRes = await request.post("/api/plaid/items", {
      headers: withSession(cookie),
      data: {
        publicToken: secondToken,
        institutionId: DEFAULT_SANDBOX_INSTITUTION_ID,
      },
    });
    await expectStatus(dupeRes, 409);
    const dupeBody = (await dupeRes.json()) as {
      data: { itemId: string; duplicate: boolean };
      message?: string;
    };
    expect(dupeBody.data.duplicate).toBe(true);
    expect(dupeBody.data.itemId).toBe(firstBody.data.itemId);

    // And still exactly one item on the user's list.
    const listRes = await request.get("/api/items", {
      headers: withSession(cookie),
    });
    await expectOk(listRes);
    const items = (await listRes.json()).data.items as Array<{ id: string }>;
    const forThisInstitution = items.filter(
      (i) => i.id === firstBody.data.itemId,
    );
    expect(forThisInstitution).toHaveLength(1);
  });
});
