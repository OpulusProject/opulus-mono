import { getSession } from "@/services/session/getSession.js";
import {
  ACCOUNT_TYPES,
  AccountsResponse,
  bankAccountService,
  toAccountWithConnectionDTO,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Query parameter schema for the accounts endpoint. `type` accepts one or more
 * account types, either repeated (?type=credit&type=loan) or comma-separated
 * (?type=credit,loan).
 */
export const getAccountsQuerySchema = z.object({
  type: z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      const parts = (Array.isArray(value) ? value : [value]).flatMap((part) =>
        String(part).split(",")
      );
      return parts.map((part) => part.trim()).filter(Boolean);
    },
    z.array(z.enum(ACCOUNT_TYPES)).optional()
  ),
});

/**
 * Get the authenticated user's accounts across all their connections
 * GET /api/accounts?type=credit,loan
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getAccountsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const { type } = req.validatedQuery as z.infer<
      typeof getAccountsQuerySchema
    >;

    const accounts = await bankAccountService.getAllByUserId(
      session.user.id,
      type
    );

    const response: AccountsResponse = {
      data: { accounts: accounts.map(toAccountWithConnectionDTO) },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
