import { getRequestSession } from "@/middleware/session/requireSession.js";
import { SessionResponse, toSessionDTO } from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Get current user session
 * GET /api/session
 */
export async function sessionController(
  req: Request,
  res: Response<SessionResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    res.status(200).json({ data: toSessionDTO(session) });
  } catch (error) {
    // Pass error to error handling middleware
    next(error);
  }
}
