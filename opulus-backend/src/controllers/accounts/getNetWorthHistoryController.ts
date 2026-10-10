import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getNetWorthHistory } from "@/services/accounts/getNetWorthHistory.js";
import { NetWorthHistoryResponse, NetWorthRangeSchema } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/** Query parameter schema for the net worth history endpoint. */
export const getNetWorthHistoryQuerySchema = z.object({
  range: NetWorthRangeSchema.default("1m"),
});

/**
 * Get the authenticated user's net worth for each day in a range
 * GET /api/accounts/net-worth?range=1m
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getNetWorthHistoryController(
  req: Request,
  res: Response<NetWorthHistoryResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    const { range } =
      getValidatedQuery<typeof getNetWorthHistoryQuerySchema>(req);

    const { series } = await getNetWorthHistory({
      userId: session.user.id,
      range,
    });

    res.status(200).json({ data: { range, series } });
  } catch (error) {
    next(error);
  }
}
