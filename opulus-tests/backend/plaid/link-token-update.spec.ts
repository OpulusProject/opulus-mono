import { expect, test } from "@playwright/test";

test.describe("POST /api/plaid/link-token/update", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/plaid/link-token/update", {
      data: { itemId: "item_1" },
    });
    expect(res.status()).toBe(401);
  });
});
