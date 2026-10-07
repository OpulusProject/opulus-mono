/**
 * Get Institutions endpoint DTOs
 */

import type { Institution } from "plaid";

/**
 * Institution as returned by the API
 * Only includes fields the client uses, in the API's camelCase
 */
export interface InstitutionDTO {
  id: string;
  name: string;
  logo: string | null;
  primaryColor: string | null;
  url: string | null;
}

/**
 * Institutions API response
 * `total` is how many institutions Plaid has; `count` is how many are in
 * this response.
 */
export interface InstitutionsResponse {
  data: {
    institutions: InstitutionDTO[];
    total: number;
    count: number;
  };
}

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
