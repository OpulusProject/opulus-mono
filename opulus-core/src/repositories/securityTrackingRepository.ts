import type { Prisma } from "@prisma/client";
import { resolveSymbol, type SymbolInput } from "../utils/securitySymbol.js";

/** What tracking needs to know about a security as stored. */
export interface StoredSecurityTracking {
  id: string;
  priceStatus: string | null;
  priceSymbol: string | null;
  priceSymbolSource: string | null;
}

/**
 * Track a security: make sure it has a price symbol and status, worked out from
 * Plaid's ticker and exchange. Run wherever securities are stored (holdings and
 * investment transactions), inside that transaction, so a security is tracked
 * from the moment we first see it, whether or not anyone holds it later.
 * Securities are never deleted, so tracking never ends.
 *
 * An `auto` symbol follows the security if it would now be different (Plaid
 * corrected the ticker or exchange): it is reset to be priced and backfilled
 * again. A `manual` symbol is the user's to keep and is left alone.
 */
export async function trackSecurity(
  tx: Prisma.TransactionClient,
  stored: StoredSecurityTracking,
  security: SymbolInput
): Promise<void> {
  const resolved = resolveSymbol(security);

  if (stored.priceStatus === null) {
    await tx.security.update({
      where: { id: stored.id },
      data: {
        priceSymbol: resolved.symbol,
        priceSymbolSource: "auto",
        priceStatus: resolved.status,
      },
    });
  } else if (
    stored.priceSymbolSource === "auto" &&
    stored.priceSymbol !== resolved.symbol
  ) {
    await tx.security.update({
      where: { id: stored.id },
      data: {
        priceSymbol: resolved.symbol,
        priceStatus: resolved.status,
        priceFailures: 0,
        priceAttemptedAt: null,
        priceHistoryFrom: null,
        priceBackfilledAt: null,
      },
    });
  }
}
