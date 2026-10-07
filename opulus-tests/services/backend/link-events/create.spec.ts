import { test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import {
  expectStatus,
  expectValidationError,
} from "../../../shared/assertions.js";
import { createAuthedUser } from "../../../shared/fixtures/index.js";

/**
 * This file: the endpoint the frontend reports Plaid Link events to, which
 * writes them to the service's logs. It has no response body and no stored
 * state, so what is checked here is the boundary: authentication, validation,
 * and that a well-formed event is accepted.
 */
test.describe("POST /api/link-events", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/link-events", {
      data: { eventName: "OPEN", mode: "new" },
    });
    await expectStatus(res, 401);
  });

  test("rejects a missing eventName (validation)", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/link-events", {
      headers: withSession(cookie),
      data: { mode: "new" },
    });

    // Assert
    await expectValidationError(res);
  });

  test("rejects an unknown mode (validation)", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/link-events", {
      headers: withSession(cookie),
      data: { eventName: "OPEN", mode: "delete-everything" },
    });

    // Assert
    await expectValidationError(res);
  });

  test("accepts an event with only the required fields (204)", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/link-events", {
      headers: withSession(cookie),
      data: { eventName: "OPEN", mode: "new" },
    });

    // Assert
    await expectStatus(res, 204);
  });

  test("accepts an error event with Plaid's ids and error details (204)", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/link-events", {
      headers: withSession(cookie),
      data: {
        eventName: "ERROR",
        mode: "reconnect",
        itemId: "item_1",
        linkSessionId: "link-session-1",
        requestId: "request-1",
        institutionId: "ins_109508",
        institutionName: "First Platypus Bank",
        viewName: "CREDENTIAL",
        errorType: "ITEM_ERROR",
        errorCode: "ITEM_LOGIN_REQUIRED",
        errorMessage: "the login details of this item have changed",
      },
    });

    // Assert
    await expectStatus(res, 204);
  });
});
