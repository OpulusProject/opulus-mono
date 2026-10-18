import { expect, test } from "@playwright/test";
import { handlePlaidWebhook } from "../../../../opulus-webhooks/src/plaid/handlePlaidWebhook.js";
import { webhookQueue } from "../../../../opulus-webhooks/src/queue/webhookQueue.js";

type Args = Parameters<typeof handlePlaidWebhook>;

/** A response that remembers what it was told. */
function fakeResponse() {
  const sent: { status?: number; body?: unknown } = {};
  const res = {
    headersSent: false,
    status(code: number) {
      sent.status = code;
      return res;
    },
    json(body: unknown) {
      sent.body = body;
      res.headersSent = true;
      return res;
    },
  };
  return { res: res as unknown as Args[1], sent };
}

const original = webhookQueue.add.bind(webhookQueue);

/**
 * This file: the receiver's route handler, run in this process with the queue
 * made to fail, since a real queue failing is not something a request can
 * provoke. The ordinary acknowledge-and-queue path is in webhook/plaid.spec.ts.
 *
 * Test cases:
 * - a webhook that cannot be queued has already been acknowledged, and the failure is only logged
 * - a request the handler cannot read at all is passed to the error handler, before any acknowledgement
 */
test.describe("handlePlaidWebhook", () => {
  test.afterEach(() => {
    webhookQueue.add = original as typeof webhookQueue.add;
  });

  test.afterAll(async () => {
    await webhookQueue.close();
  });

  test("a webhook that cannot be queued has already been acknowledged, and the failure is only logged", async () => {
    // Arrange
    webhookQueue.add = (async () => {
      throw new Error("Redis went away");
    }) as typeof webhookQueue.add;
    const { res, sent } = fakeResponse();
    const forwarded: unknown[] = [];

    // Act
    await handlePlaidWebhook(
      { body: { webhook_type: "ITEM", webhook_code: "ERROR", item_id: "item-1" } } as Args[0],
      res,
      ((error?: unknown) => forwarded.push(error)) as Args[2],
    );

    // Assert: Plaid was told it arrived (it would otherwise resend), and nothing was passed on.
    expect(sent).toEqual({ status: 200, body: { received: true } });
    expect(forwarded).toEqual([]);
  });

  test("a request the handler cannot read at all is passed to the error handler, before any acknowledgement", async () => {
    // Arrange: no body to take a webhook type from.
    const { res, sent } = fakeResponse();
    const forwarded: unknown[] = [];

    // Act
    await handlePlaidWebhook({} as Args[0], res, ((error?: unknown) => forwarded.push(error)) as Args[2]);

    // Assert
    expect(sent).toEqual({});
    expect(forwarded).toHaveLength(1);
    expect(forwarded[0]).toBeInstanceOf(Error);
  });
});
