import { getRequestSession } from "@/middleware/session/requireSession.js";
import { exportUserData } from "@/services/user/exportUserData.js";
import { Request, Response } from "express";
import { streamChunks } from "./streamChunks.js";

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
export async function exportUserDataController(req: Request, res: Response) {
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

  await streamChunks(res, userExport.chunks(), { user_id: user.id });
}
