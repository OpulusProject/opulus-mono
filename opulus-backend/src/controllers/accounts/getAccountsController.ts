import { getValidatedQuery } from "@/middleware/validation.js";
import { getSession } from "@/services/session/getSession.js";
import {
  ACCOUNT_TYPES,
  accountService,
  AccountsResponse,
  toAccountWithConnectionDTO,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Query parameter schema for the accounts endpoint. `type` may be given
 * once or repeated to filter by several types (?type=credit&type=loan).
 */
export const getAccountsQuerySchema = z.object({
  type: z.preprocess(
    (value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    z.array(z.enum(ACCOUNT_TYPES)).optional()
  ),
});

/**
 * Get the authenticated user's accounts across all their connections
 * GET /api/accounts?type=credit&type=loan
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getAccountsController(
  req: Request,
  res: Response<AccountsResponse>,
  next: NextFunction
) {
  try {
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const { type } = getValidatedQuery<typeof getAccountsQuerySchema>(req);

    const accounts = await accountService.getAllByUserId(session.user.id, type);

    res.status(200).json({
      data: { accounts: accounts.map(toAccountWithConnectionDTO) },
    });
  } catch (error) {
    next(error);
  }
}
