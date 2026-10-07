import { getInstitutions } from "@/services/institutions/getInstitutions.js";
import { InstitutionsResponse, toInstitutionDTO } from "@opulus/core";
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
    const { institutions, total } = await getInstitutions();

    res.status(200).json({
      data: {
        institutions: institutions.map(toInstitutionDTO),
        total,
        count: institutions.length,
      },
    });
  } catch (error) {
    next(error);
  }
}
