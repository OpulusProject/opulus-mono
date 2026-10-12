import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getNetWorthHistory } from "@/services/accounts/getNetWorthHistory.js";
import { NetWorthHistoryResponse, NetWorthRangeSchema } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Query parameter schema for the net worth history endpoint. `accountId` may be
 * given once or repeated to limit it to several accounts (?accountId=a&accountId=b).
 */
export const getNetWorthHistoryQuerySchema = z.object({
  range: NetWorthRangeSchema.default("1m"),
  accountId: z.preprocess(
    (value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    z.array(z.string().min(1)).optional()
  ),
});

/**
 * Get the authenticated user's net worth for each day in a range
 * GET /api/accounts/net-worth?range=1m&accountId=acct_1
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

    const { range, accountId } =
      getValidatedQuery<typeof getNetWorthHistoryQuerySchema>(req);

    const { series } = await getNetWorthHistory({
      userId: session.user.id,
      range,
      accountIds: accountId,
    });

    res.status(200).json({ data: { range, series } });
  } catch (error) {
    next(error);
  }
}
