import { expect, test } from "@playwright/test";
import { expectOk } from "../helpers/assertions.js";

/**
 * This file: the liveness endpoint.
 */
test.describe("GET /health", () => {
  test("reports the receiver as ok", async ({ request }) => {
    // Act
    const res = await request.get("/health");

    // Assert
    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "ok", service: "webhooks" });
  });
});
