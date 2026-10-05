import { getSession } from "@/services/session/getSession.js";
import { plaidService, UnauthorizedError } from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Get all institutions from Plaid
 * GET /api/plaid/institutions
 */
export async function getInstitutionsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get authenticated user session
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    // Get institutions from Plaid
    const institutionsResponse = await plaidService.getInstitutions();

    res.status(200).json({
      data: {
        institutions: institutionsResponse.institutions,
        total: institutionsResponse.total,
        count: institutionsResponse.institutions.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

