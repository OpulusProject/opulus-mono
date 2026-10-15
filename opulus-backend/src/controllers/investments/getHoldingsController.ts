import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getHoldings } from "@/services/investments/getHoldings.js";
import { HoldingsResponse } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/** Query parameters for the holdings endpoint. */
export const getHoldingsQuerySchema = z.object({
  /** Only this account's holdings (our account id). */
  accountId: z.string().min(1).optional(),
});

/**
 * Get the authenticated user's investment holdings
 * GET /api/investments/holdings?accountId=acct_1
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getHoldingsController(
  req: Request,
  res: Response<HoldingsResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);
    const { accountId } = getValidatedQuery<typeof getHoldingsQuerySchema>(req);

    const data = await getHoldings({ userId: session.user.id, accountId });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}
