import { getRequestSession } from "@/middleware/session/requireSession.js";
import { exportUserData } from "@/services/user/exportUserData.js";
import { logger } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { once } from "node:events";

/**
 * Download everything we hold about the authenticated user, as JSON
 * GET /api/user/export
 *
 * The answer is a file (Content-Disposition: attachment) written in pieces, so
 * a long history is never held in memory as one string. Reading the small parts
 * happens before anything is sent, so a failure there is still a normal error
 * response; a failure after that ends the connection early (the download is
 * cut short, and is not valid JSON).
 */
export async function exportUserDataController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = getRequestSession(res);
    const userExport = await exportUserData({ userId: user.id });

    const day = new Date().toISOString().slice(0, 10);
    res.status(200);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="opulus-export-${day}.json"`
    );
    res.setHeader("Cache-Control", "no-store");

    try {
      for await (const chunk of userExport.chunks()) {
        // Wait when the client reads slower than we write.
        if (!res.write(chunk)) await once(res, "drain");
      }
      res.end();
    } catch (error) {
      logger.error(
        {
          user_id: user.id,
          error_message: error instanceof Error ? error.message : String(error),
        },
        "User data export failed after it had started"
      );
      res.destroy(error instanceof Error ? error : undefined);
    }
  } catch (error) {
    next(error);
  }
}
