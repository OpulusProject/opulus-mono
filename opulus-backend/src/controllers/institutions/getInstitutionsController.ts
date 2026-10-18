import { getInstitutions } from "@/services/institutions/getInstitutions.js";
import { InstitutionsResponse, toInstitutionDTO } from "@opulus/core";
import { Request, Response } from "express";

/**
 * Get all institutions from Plaid
 * GET /api/institutions
 */
export async function getInstitutionsController(
  req: Request,
  res: Response<InstitutionsResponse>
) {
  const { institutions, total } = await getInstitutions();

  res.status(200).json({
    data: {
      institutions: institutions.map(toInstitutionDTO),
      total,
      count: institutions.length,
    },
  });
}
