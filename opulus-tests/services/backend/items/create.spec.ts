import { expect, test } from "@playwright/test";
import { CreateItemResponseSchema } from "@opulus/core";

import { expectMatchesSchema, expectOk, expectStatus } from "../../../shared/assertions.js";
import { uniqueId, withSession } from "../../../shared/client.js";
import { readStoredItemAccessToken } from "../../../shared/db.js";
import { createAuthedUser } from "../../../shared/fixtures/auth.js";
import { describeInstitution, plaidAccount } from "../../../shared/scenarios/plaid.js";
import { exchangedPublicTokens, failInstitutionLookup, resetPlaidStub } from "../../../shared/plaid-stub.js";

/**
 * POST /api/items: linking an institution from a public token. Plaid is the
 * stub, so this covers the service's own logic (validation, what is stored, the
 * duplicate short-circuit); that the real Plaid accepts what we send is the
 * integration suite's one link test.
 */
test.describe("POST /api/items", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("rejects missing publicToken with a validation error (400)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.post("/api/items", {
      headers: withSession(cookie),
      data: { institutionId: "ins_109508" },
    });
    await expectStatus(res, 400);
  });

  test("rejects missing institutionId with a validation error (400)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.post("/api/items", {
      headers: withSession(cookie),
      data: { publicToken: "public-sandbox-does-not-matter" },
    });
    await expectStatus(res, 400);
  });

  test("creates an item from a public token and shows it, with its accounts, on GET /api/items", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const institutionId = await describeInstitution([plaidAccount(uniqueId("a")), plaidAccount(uniqueId("b"))]);

    // Act
    const res = await request.post("/api/items", {
      headers: withSession(cookie),
      data: { publicToken: uniqueId("public-stub"), institutionId },
    });

    // Assert: 201 and { itemId, duplicate: false }, then the item is listed with both accounts.
    await expectStatus(res, 201);
    await expectMatchesSchema(res, CreateItemResponseSchema);
    const { itemId, duplicate } = (await res.json()).data as { itemId: string; duplicate: boolean };
    expect(duplicate).toBe(false);
    const list = await request.get("/api/items", { headers: withSession(cookie) });
    await expectOk(list);
    const items = (await list.json()).data.items as Array<{ id: string; accounts: unknown[] }>;
    expect(items.find((i) => i.id === itemId)?.accounts).toHaveLength(2);
  });

  test("stores the Plaid access token encrypted, never as plaintext", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    const institutionId = await describeInstitution([plaidAccount(uniqueId("a"))]);

    // Act
    const res = await request.post("/api/items", {
      headers: withSession(cookie),
      data: { publicToken: uniqueId("public-stub"), institutionId },
    });
    await expectStatus(res, 201);
    const { itemId } = (await res.json()).data as { itemId: string };

    // Assert: this is the one check that has to look at the column, because no
    // endpoint exposes the token. It is versioned ciphertext that does not hold
    // the token Plaid issued.
    const stored = await readStoredItemAccessToken(itemId);
    expect(stored).toMatch(/^enc:v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(stored).not.toContain("access-stub");
  });

  test("links the institution even when Plaid cannot describe it, leaving its name empty", async ({ request }) => {
    // Arrange: the accounts are fine, but the institution lookup (optional) fails.
    const { cookie } = await createAuthedUser(request);
    const institutionId = await describeInstitution([plaidAccount(uniqueId("a"))], "Named Bank");
    await failInstitutionLookup("INTERNAL_SERVER_ERROR");

    // Act
    const res = await request.post("/api/items", {
      headers: withSession(cookie),
      data: { publicToken: uniqueId("public-stub"), institutionId },
    });

    // Assert
    await expectStatus(res, 201);
    const { itemId } = (await res.json()).data as { itemId: string };
    const items = (await (await request.get("/api/items", { headers: withSession(cookie) })).json()).data.items as Array<{
      id: string;
      institutionName: string | null;
      accounts: unknown[];
    }>;
    expect(items.find((i) => i.id === itemId)).toMatchObject({ institutionName: null, accounts: [expect.anything()] });
  });

  test("answers 409 for a second link to the same institution, without exchanging its public token", async ({ request }) => {
    // Arrange: one item already linked to the institution.
    const { cookie } = await createAuthedUser(request);
    const institutionId = await describeInstitution([plaidAccount(uniqueId("a"))]);
    const first = await request.post("/api/items", {
      headers: withSession(cookie),
      data: { publicToken: "public-first", institutionId },
    });
    await expectStatus(first, 201);
    const firstItem = (await first.json()).data.itemId as string;

    // Act
    const second = await request.post("/api/items", {
      headers: withSession(cookie),
      data: { publicToken: "public-second", institutionId },
    });

    // Assert: refused, pointing at the first item; the second token never went to Plaid
    // (had it, Plaid would have issued a second item), and there is still one item.
    await expectStatus(second, 409);
    await expectMatchesSchema(second, CreateItemResponseSchema);
    expect((await second.json()).data).toMatchObject({ duplicate: true, itemId: firstItem });
    expect(await exchangedPublicTokens()).toEqual(["public-first"]);
    const list = await request.get("/api/items", { headers: withSession(cookie) });
    expect(((await list.json()).data.items as unknown[]).length).toBe(1);
  });
});
