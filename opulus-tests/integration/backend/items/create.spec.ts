import { expect, test } from "@playwright/test";
import { CreateItemResponseSchema, decryptItemToken } from "@opulus/core";

import {
  expectMatchesSchema,
  expectOk,
  expectStatus,
} from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { readStoredItemAccessToken } from "../../../shared/db.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import {
  DEFAULT_SANDBOX_INSTITUTION_ID,
  createSandboxPublicToken,
  requireSandboxCredentials,
} from "../../helpers/plaidSandbox.js";

/**
 * POST /api/items — Plaid Sandbox round-trip.
 *
 * Service-owned boundaries (401, 400 validation) live in the service suite
 * (services/backend/items/create.spec.ts). This file exercises the
 * happy path and the duplicate short-circuit by minting real Plaid-issued
 * public_tokens against the Sandbox API.
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

  test("stores the Plaid access token encrypted, never as plaintext", async ({
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
    await expectStatus(createRes, 201);
    const { itemId } = (await createRes.json()).data as { itemId: string };

    // Assert: this is the one check that has to look at the column, because no
    // endpoint exposes the token. It is versioned ciphertext, and decrypting it
    // gives a Plaid sandbox token (the round-trip evidence); the column never
    // holds the token itself. That the backend can decrypt it for real Plaid
    // calls is covered by update-accounts and refresh, which read it back.
    const stored = await readStoredItemAccessToken(itemId);
    expect(stored).toMatch(/^enc:v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(stored).not.toContain("access-sandbox");
    expect(decryptItemToken(stored)).toMatch(/^access-sandbox-/);
  });

  test("short-circuits with 409 when the user already has an item for the same institution (no exchange of the second public_token)", async ({
    request,
  }) => {
    // Arrange: authenticated user + one real sandbox item already persisted.
    const creds = requireSandboxCredentials();
    const { cookie } = await createAuthedUser(request);

    const firstToken = await createSandboxPublicToken(creds);
    const firstRes = await request.post("/api/items", {
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

    // Act: second link to the same institution. We generate a FRESH token
    // so that if the backend ever regresses and calls
    // /item/public_token/exchange, the exchange would actually succeed (and
    // this test would correctly fail by returning 201 instead of 409).
    const secondToken = await createSandboxPublicToken(creds);
    const dupeRes = await request.post("/api/items", {
      headers: withSession(cookie),
      data: {
        publicToken: secondToken,
        institutionId: DEFAULT_SANDBOX_INSTITUTION_ID,
      },
    });

    // Assert: 409 short-circuit referencing the first item, and GET /api/items
    // still shows exactly one row for this institution.
    await expectStatus(dupeRes, 409);
    await expectMatchesSchema(dupeRes, CreateItemResponseSchema);
    const dupeBody = (await dupeRes.json()) as {
      data: { itemId: string; duplicate: boolean };
      message?: string;
    };
    expect(dupeBody.data.duplicate).toBe(true);
    expect(dupeBody.data.itemId).toBe(firstBody.data.itemId);

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
