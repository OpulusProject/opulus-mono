import { getRequestSession } from "@/middleware/session/requireSession.js";
import { SessionResponse, toSessionDTO } from "@opulus/core";
import { Request, Response } from "express";

/**
 * Get current user session
 * GET /api/session
 */
export async function sessionController(
  req: Request,
  res: Response<SessionResponse>
) {
  const session = getRequestSession(res);

  res.status(200).json({ data: toSessionDTO(session) });
}
