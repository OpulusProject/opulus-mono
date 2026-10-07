/**
 * Get Institutions endpoint DTOs
 */

import type { Institution } from "plaid";
import { z } from "zod";

/**
 * Institution as returned by the API
 * Only includes fields the client uses, in the API's camelCase
 */
export const InstitutionDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().nullable(),
  primaryColor: z.string().nullable(),
  url: z.string().nullable(),
});

export type InstitutionDTO = z.infer<typeof InstitutionDTOSchema>;

/**
 * Institutions API response
 * `total` is how many institutions Plaid has; `count` is how many are in
 * this response.
 */
export const InstitutionsResponseSchema = z.object({
  data: z.object({
    institutions: z.array(InstitutionDTOSchema),
    total: z.number().int(),
    count: z.number().int(),
  }),
});

export type InstitutionsResponse = z.infer<typeof InstitutionsResponseSchema>;

/**
 * Transform a Plaid institution to the public DTO
 * @param institution - Institution from Plaid
 * @returns Public DTO with only the fields the client uses
 */
export function toInstitutionDTO(
  institution: Pick<
    Institution,
    "institution_id" | "name" | "logo" | "primary_color" | "url"
  >
): InstitutionDTO {
  return {
    id: institution.institution_id,
    name: institution.name,
    logo: institution.logo ?? null,
    primaryColor: institution.primary_color ?? null,
    url: institution.url ?? null,
  };
}
