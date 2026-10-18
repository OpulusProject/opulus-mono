import { logger } from "@opulus/core";
import type { Response } from "express";
import { once } from "node:events";

/**
 * Write a response in pieces as they are produced, so a long one is never held
 * in memory whole, waiting whenever the client reads slower than we write. If
 * producing a piece fails the response has already started, so it cannot become
 * an error response: the failure is logged and the connection ended early (the
 * download is cut short).
 *
 * @param context - Fields to put on the log line if it fails
 */
export async function streamChunks(
  res: Response,
  chunks: AsyncIterable<string>,
  context: Record<string, unknown> = {}
): Promise<void> {
  try {
    for await (const chunk of chunks) {
      // Wait when the client reads slower than we write.
      if (!res.write(chunk)) await once(res, "drain");
    }
    res.end();
  } catch (error) {
    logger.error(
      {
        ...context,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Streamed response failed after it had started"
    );
    res.destroy(error instanceof Error ? error : undefined);
  }
}
