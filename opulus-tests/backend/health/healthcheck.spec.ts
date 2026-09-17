import { expect, test } from "@playwright/test";
import { expectOk } from "../helpers/assertions.js";

/**
 * This file: the API-router healthcheck endpoint.
 */
test.describe("GET /api/healthcheck", () => {
  test("reports the API as healthy", async ({ request }) => {
    // Act
    const res = await request.get("/api/healthcheck");

    // Assert
    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "OK" });
  });
});
