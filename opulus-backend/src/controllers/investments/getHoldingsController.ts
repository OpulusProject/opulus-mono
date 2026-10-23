import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedQuery } from "@/middleware/validation.js";
import { getHoldings } from "@/services/investments/getHoldings.js";
import { HoldingsRangeSchema, HoldingsResponse } from "@opulus/core";
import { Request, Response } from "express";
import { z } from "zod";

/** A value given once or repeated (?accountId=a&accountId=b), as a list. */
const asList = (value: unknown) =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

/** Query parameters for the holdings endpoint. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const getHoldingsQuerySchema = z
  .object({
    /** Only these accounts' holdings (our account ids), given once or repeated. */
    accountId: z.preprocess(asList, z.array(z.string().min(1)).optional()),
    /** Only holdings of this security (our security id). */
    securityId: z.string().min(1).optional(),
    /** The period the gains are over; since purchase when omitted. */
    range: HoldingsRangeSchema.optional(),
    /** The first and last day of a `custom` range; the last is today when omitted. */
    from: z.string().regex(DAY).optional(),
    to: z.string().regex(DAY).optional(),
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
 * Get the authenticated user's investment holdings
 * GET /api/investments/holdings?accountId=acct_1&accountId=acct_2&securityId=sec_1&range=month
 * GET /api/investments/holdings?range=custom&from=2026-01-01&to=2026-03-31
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getHoldingsController(
  req: Request,
  res: Response<HoldingsResponse>
) {
  const session = getRequestSession(res);
  const {
    accountId: accountIds,
    securityId,
    range,
    from,
    to,
  } = getValidatedQuery<typeof getHoldingsQuerySchema>(req);

  const data = await getHoldings({
    userId: session.user.id,
    accountIds,
    securityId,
    range,
    from,
    to,
  });

  res.status(200).json({ data });
}
