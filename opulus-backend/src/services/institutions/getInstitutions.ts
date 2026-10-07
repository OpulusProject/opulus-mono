import { plaidGateway, toInstitutionDTO } from "@opulus/core";

/** An institution as Plaid returns it. */
type PlaidInstitution = Parameters<typeof toInstitutionDTO>[0];

export interface GetInstitutionsResult {
  institutions: PlaidInstitution[];
  /** How many institutions Plaid has, which can be more than were returned. */
  total: number;
}

/**
 * List the institutions a user can connect, from Plaid.
 *
 * Not specific to a user, so it takes no params; the route's `requireSession`
 * keeps it to signed-in users.
 */
export async function getInstitutions(): Promise<GetInstitutionsResult> {
  const response = await plaidGateway.getInstitutions();

  return { institutions: response.institutions, total: response.total };
}
