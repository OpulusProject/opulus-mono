import { EventEmitter } from "node:events";
import { expect, test } from "@playwright/test";
import { streamChunks } from "../../../opulus-backend/src/controllers/user/streamChunks.js";

type Response = Parameters<typeof streamChunks>[0];

/** A response that remembers what it was given; `slow` makes write() say the client cannot keep up until it drains. */
function fakeResponse(options: { slow?: boolean } = {}) {
  const emitter = new EventEmitter();
  const seen = { written: [] as string[], ended: false, destroyedWith: undefined as unknown, destroyed: false };
  let first = true;
  const res = Object.assign(emitter, {
    write(chunk: string) {
      seen.written.push(chunk);
      if (options.slow && first) {
        first = false;
        setTimeout(() => emitter.emit("drain"), 20);
        return false;
      }
      return true;
    },
    end() {
      seen.ended = true;
    },
    destroy(error?: unknown) {
      seen.destroyed = true;
      seen.destroyedWith = error;
    },
  });
  return { res: res as unknown as Response, seen };
}

async function* pieces(...values: (string | Error)[]) {
  for (const value of values) {
    if (value instanceof Error) throw value;
    yield value;
  }
}

/**
 * Writing a response in pieces (opulus-backend/src/controllers/user/streamChunks.ts),
 * which is how the data export is sent so a long history is never held in memory.
 *
 * Test cases:
 * - writes every piece in order and ends the response
 * - waits for the client to catch up when it cannot keep up
 * - a failure part-way ends the connection with that error instead of ending the response normally
 */
test.describe("streamChunks", () => {
  test("writes every piece in order and ends the response", async () => {
    const { res, seen } = fakeResponse();

    await streamChunks(res, pieces("a", "b", "c"));

    expect(seen).toMatchObject({ written: ["a", "b", "c"], ended: true, destroyed: false });
  });

  test("waits for the client to catch up when it cannot keep up", async () => {
    const { res, seen } = fakeResponse({ slow: true });
    const started = Date.now();

    await streamChunks(res, pieces("a", "b"));

    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
    expect(seen).toMatchObject({ written: ["a", "b"], ended: true });
  });

  test("a failure part-way ends the connection with that error instead of ending the response normally", async () => {
    const { res, seen } = fakeResponse();
    const failure = new Error("the database went away");

    await streamChunks(res, pieces("a", failure), { user_id: "user-1" });

    expect(seen.written).toEqual(["a"]);
    expect(seen.ended).toBe(false);
    expect(seen.destroyed).toBe(true);
    expect(seen.destroyedWith).toBe(failure);
  });
});
