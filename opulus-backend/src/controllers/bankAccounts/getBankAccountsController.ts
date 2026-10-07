import { getValidatedQuery } from "@/middleware/validation.js";
import { getSession } from "@/services/session/getSession.js";
import {
  BANK_ACCOUNT_TYPES,
  bankAccountService,
  BankAccountsResponse,
  toBankAccountWithConnectionDTO,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Query parameter schema for the bank accounts endpoint. `type` may be given
 * once or repeated to filter by several types (?type=credit&type=loan).
 */
export const getBankAccountsQuerySchema = z.object({
  type: z.preprocess(
    (value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    z.array(z.enum(BANK_ACCOUNT_TYPES)).optional()
  ),
});

/**
 * Get the authenticated user's bank accounts across all their connections
 * GET /api/bank-accounts?type=credit&type=loan
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getBankAccountsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const { type } = getValidatedQuery<typeof getBankAccountsQuerySchema>(req);

    const bankAccounts = await bankAccountService.getAllByUserId(
      session.user.id,
      type
    );

    const response: BankAccountsResponse = {
      data: { accounts: bankAccounts.map(toBankAccountWithConnectionDTO) },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
