import { optionalInt } from "@/controllers/transactions/transactionFilterQuery.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getActivity } from "@/services/investments/getActivity.js";
import {
  ACTIVITY_KINDS,
  ActivityResponse,
  HoldingsRangeSchema,
} from "@opulus/core";
import { Request, Response } from "express";
import { z } from "zod";

/** A value given once or repeated (?accountId=a&accountId=b), as a list. */
const asList = (value: unknown) =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Query parameters for the activity endpoint. */
export const getActivityQuerySchema = z
  .object({
    /** Only these accounts' activity (our account ids), given once or repeated. */
    accountId: z.preprocess(asList, z.array(z.string().min(1)).optional()),
    /** Only this security's activity (our security id, as holdings give it). */
    securityId: z.string().min(1).optional(),
    kind: z.enum(ACTIVITY_KINDS).optional(),
    /** The period to look at, as the holdings take it; all time when omitted. */
    range: HoldingsRangeSchema.optional(),
    /** The first and last day of a `custom` range; the last is today when omitted. */
    from: z.string().regex(DAY).optional(),
    to: z.string().regex(DAY).optional(),
    page: optionalInt(),
    limit: optionalInt(200),
  })
  .refine((query) => query.range !== "custom" || query.from !== undefined, {
    message: "A custom range needs a from day",
    path: ["from"],
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "from must not be after to",
    path: ["to"],
  });

/**
 * Get a page of the authenticated user's investment activity
 * GET /api/investments/activity?kind=dividend&accountId=acct_1&accountId=acct_2&range=ytd&page=1&limit=50
 * GET /api/investments/activity?range=custom&from=2026-01-01&to=2026-03-31
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getActivityController(
  req: Request,
  res: Response<ActivityResponse>
) {
  const session = getRequestSession(res);
  const { accountId, securityId, kind, range, from, to, page, limit } =
    getValidatedQuery<typeof getActivityQuerySchema>(req);

  const data = await getActivity({
    userId: session.user.id,
    filters: { accountIds: accountId, securityId, kind },
    range,
    from,
    to,
    page: page ?? 1,
    limit: limit ?? 50,
  });

  res.status(200).json({ data });
}
