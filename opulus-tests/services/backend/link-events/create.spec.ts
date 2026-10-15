import { expect, test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import {
  expectStatus,
  expectValidationError,
} from "../../../shared/assertions.js";
import {
  createAuthedUser,
  readLinkEvents,
  readSessionIds,
  signIn,
  TEST_PASSWORD,
} from "../../../shared/fixtures/index.js";

/**
 * This file: the endpoint the frontend reports Plaid Link events to. It has no
 * response body, so the checks are the boundary (authentication, validation,
 * 204) and what it stored, read from the test DB: each event belongs to the
 * user and to the login session it was reported in.
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

  test("stores the event with its user and the session it was reported in", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);

    // Act
    await request.post("/api/link-events", {
      headers: withSession(cookie),
      data: { eventName: "OPEN", mode: "new" },
    });

    // Assert
    const [sessionId] = await readSessionIds(userId);
    const events = await readLinkEvents(userId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId,
      sessionId,
      eventName: "OPEN",
      mode: "new",
      plaidLinkSessionId: null,
    });
  });

  test("tells apart the sessions of one user", async ({ request }) => {
    // Arrange: the same user signed in twice, so two login sessions.
    const first = await createAuthedUser(request);
    const email = first.email;
    const second = await signIn(request, email, TEST_PASSWORD);

    // Act
    for (const cookie of [first.cookie, second.cookie]) {
      await request.post("/api/link-events", {
        headers: withSession(cookie),
        data: { eventName: "OPEN", mode: "new" },
      });
    }

    // Assert: one event in each session.
    const sessionIds = await readSessionIds(first.userId);
    const events = await readLinkEvents(first.userId);
    expect(sessionIds).toHaveLength(2);
    expect(events.map((e) => e.sessionId).sort()).toEqual(
      [...sessionIds].sort(),
    );
  });

  test("keeps the events of one Link flow together by Plaid's link session id", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);

    // Act
    for (const eventName of ["OPEN", "ERROR", "EXIT"]) {
      await request.post("/api/link-events", {
        headers: withSession(cookie),
        data: {
          eventName,
          mode: "new",
          plaidLinkSessionId: "link-session-1",
        },
      });
    }

    // Assert: in the order they were reported.
    const events = await readLinkEvents(userId);
    expect(events.map((e) => [e.eventName, e.plaidLinkSessionId])).toEqual([
      ["OPEN", "link-session-1"],
      ["ERROR", "link-session-1"],
      ["EXIT", "link-session-1"],
    ]);
  });

  test("stores nothing for an invalid event", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/link-events", {
      headers: withSession(cookie),
      data: { eventName: "OPEN", mode: "nonsense" },
    });

    // Assert
    await expectValidationError(res);
    expect(await readLinkEvents(userId)).toEqual([]);
  });

  test("stores an error event with Plaid's ids and error details (204)", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/link-events", {
      headers: withSession(cookie),
      data: {
        eventName: "ERROR",
        mode: "reconnect",
        itemId: "item_1",
        plaidLinkSessionId: "link-session-1",
        plaidRequestId: "request-1",
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
    expect(await readLinkEvents(userId)).toMatchObject([
      {
        eventName: "ERROR",
        mode: "reconnect",
        itemId: "item_1",
        plaidLinkSessionId: "link-session-1",
        plaidRequestId: "request-1",
        institutionId: "ins_109508",
        institutionName: "First Platypus Bank",
        viewName: "CREDENTIAL",
        errorType: "ITEM_ERROR",
        errorCode: "ITEM_LOGIN_REQUIRED",
        errorMessage: "the login details of this item have changed",
      },
    ]);
  });
});
