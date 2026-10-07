import { Request, Response, NextFunction } from "express";
import { getSession } from "@/services/session/getSession.js";
import { SessionResponse, toSessionDTO, UnauthorizedError } from "@opulus/core";

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
    const session = await getSession(req.headers);

    if (!session) {
      throw new UnauthorizedError("No active session");
    }

    res.status(200).json({ data: toSessionDTO(session) });
  } catch (error) {
    // Pass error to error handling middleware
    next(error);
  }
}
