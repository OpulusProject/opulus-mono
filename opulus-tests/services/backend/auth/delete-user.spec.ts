import { expect, test } from "@playwright/test";
import {
  expectErrorCode,
  expectStatus,
} from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { signIn, signUp } from "../../../shared/fixtures/index.js";

/**
 * This file: POST /api/auth/delete-user for a user with no bank connections.
 * With connections the delete first removes them from Plaid, which the service
 * suite cannot do (its items have fake access tokens), so that is covered by
 * the integration suite.
 */
test.describe("POST /api/auth/delete-user", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/auth/delete-user", {
      data: { password: "whatever" },
    });

    await expectStatus(res, 401);
  });

  test("requires the password (400, PASSWORD_REQUIRED)", async ({ request }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: {},
    });

    // Assert: refused, and the account still works.
    await expectStatus(res, 400);
    await expectErrorCode(res, "PASSWORD_REQUIRED");
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      200,
    );
  });

  test("rejects a wrong password (400, INVALID_PASSWORD)", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: "not-the-password" },
    });

    // Assert
    await expectStatus(res, 400);
    await expectErrorCode(res, "INVALID_PASSWORD");
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      200,
    );
  });

  test("deletes the account: the session ends and signing in fails", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.post("/api/auth/delete-user", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Assert
    await expectStatus(res, 200);
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      401,
    );
    await expect(signIn(request, user.email, user.password)).rejects.toThrow();
  });

  test("leaves other users alone", async ({ request }) => {
    // Arrange
    const leaving = await signUp(request);
    const staying = await signUp(request);

    // Act
    await request.post("/api/auth/delete-user", {
      headers: withSession(leaving.cookie),
      data: { password: leaving.password },
    });

    // Assert
    await expectStatus(
      await request.get("/api/session", { headers: withSession(staying.cookie) }),
      200,
    );
  });
});
