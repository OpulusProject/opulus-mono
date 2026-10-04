import { test } from "@playwright/test";
import { expectStatus } from "../../../shared/assertions.js";

test.describe("POST /api/plaid/link-token/update", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/plaid/link-token/update", {
      data: { itemId: "item_1" },
    });
    await expectStatus(res, 401);
  });
});
