import {
  InstitutionsResponse,
  plaidService,
  toInstitutionDTO,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Get all institutions from Plaid
 * GET /api/institutions
 */
export async function getInstitutionsController(
  req: Request,
  res: Response<InstitutionsResponse>,
  next: NextFunction
) {
  try {
    // Get institutions from Plaid
    const institutionsResponse = await plaidService.getInstitutions();

    res.status(200).json({
      data: {
        institutions: institutionsResponse.institutions.map(toInstitutionDTO),
        total: institutionsResponse.total,
        count: institutionsResponse.institutions.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

