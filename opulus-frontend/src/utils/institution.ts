import type { ItemDTO } from '@opulus/core/dto';

/**
 * Plaid returns an institution logo as raw base64 PNG, and only for some
 * institutions. Returns a data URL, or null so Avatar falls back to initials.
 */
export function getInstitutionLogo(
  item: Pick<ItemDTO, 'institutionLogo'>
): string | null {
  return item.institutionLogo
    ? `data:image/png;base64,${item.institutionLogo}`
    : null;
}
