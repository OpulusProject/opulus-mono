import { getRequestSession } from "@/middleware/session/requireSession.js";
import { createLinkToken } from "@/services/linkTokens/createLinkToken.js";
import { LinkTokenResponse } from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Create a Plaid Link token for the authenticated user
 * POST /api/link-tokens
 */
export async function createLinkTokenController(
  req: Request,
  res: Response<LinkTokenResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    const { linkToken } = await createLinkToken({ userId: session.user.id });

    res.status(200).json({ data: { linkToken } });
  } catch (error) {
    next(error);
  }
}
