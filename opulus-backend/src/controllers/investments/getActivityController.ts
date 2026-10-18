import {
  optionalDate,
  optionalInt,
} from "@/controllers/transactions/transactionFilterQuery.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getActivity } from "@/services/investments/getActivity.js";
import { ACTIVITY_KINDS, ActivityResponse } from "@opulus/core";
import { Request, Response } from "express";
import { z } from "zod";

/** Query parameters for the activity endpoint. */
export const getActivityQuerySchema = z.object({
  /** Only this account's activity (our account id). */
  accountId: z.string().min(1).optional(),
  /** Only this security's activity (our security id, as holdings give it). */
  securityId: z.string().min(1).optional(),
  kind: z.enum(ACTIVITY_KINDS).optional(),
  /** First day, inclusive. */
  startDate: optionalDate,
  /** Last day, inclusive. */
  endDate: optionalDate,
  page: optionalInt(),
  limit: optionalInt(200),
});

/**
 * Get a page of the authenticated user's investment activity
 * GET /api/investments/activity?kind=dividend&accountId=acct_1&startDate=2026-01-01&page=1&limit=50
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getActivityController(
  req: Request,
  res: Response<ActivityResponse>
) {
  const session = getRequestSession(res);
  const { accountId, securityId, kind, startDate, endDate, page, limit } =
    getValidatedQuery<typeof getActivityQuerySchema>(req);

  const data = await getActivity({
    userId: session.user.id,
    filters: { accountId, securityId, kind, from: startDate, to: endDate },
    page: page ?? 1,
    limit: limit ?? 50,
  });

  res.status(200).json({ data });
}
