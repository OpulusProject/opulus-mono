import { activePriceProvider } from "../gateways/activePriceProvider.js";
import type { PriceProvider } from "../gateways/priceProvider.js";
import { securityPriceRepository } from "../repositories/securityPriceRepository.js";
import { logger } from "../utils/logger.js";
import { resolveSymbol } from "../utils/securitySymbol.js";

export interface SecurityDividendsParams {
  /** Where the figures come from; the active provider unless a caller passes another. */
  provider?: PriceProvider;
  /** The current moment; only tests pass it. */
  now?: Date;
}

export interface RefreshSecurityDividendsResult {
  /** Securities asked about. */
  requested: number;
  /** Securities whose dividend rate was stored. */
  updated: number;
  /** Securities the provider had no figure for. */
  failed: number;
}

/**
 * Ask the provider what each priceable security pays out per share in a year,
 * and store it on the security. Cash, options and bonds have no provider symbol
 * and are left alone. One the provider has no figure for is logged and keeps
 * what it had; it is asked about again next time.
 *
 * Throws when the provider cannot be reached at all, so the run is retried.
 */
export async function refreshSecurityDividends(
  params: SecurityDividendsParams = {}
): Promise<RefreshSecurityDividendsResult> {
  const provider = params.provider ?? activePriceProvider;
  const now = params.now ?? new Date();

  const securities = (await securityPriceRepository.getForPricing()).flatMap(
    (security) => {
      const resolved = resolveSymbol(security);
      return resolved.status === "active"
        ? [{ securityId: security.id, symbol: resolved.symbol }]
        : [];
    }
  );
  if (securities.length === 0) return { requested: 0, updated: 0, failed: 0 };

  const results = await provider.getDividendInfo(
    securities.map((s) => s.symbol)
  );
  const bySymbol = new Map(results.map((result) => [result.symbol, result]));

  let updated = 0;
  let failed = 0;
  for (const { securityId, symbol } of securities) {
    const result = bySymbol.get(symbol);
    if (result && "info" in result) {
      await securityPriceRepository.recordDividends(
        securityId,
        result.info,
        now
      );
      updated += 1;
    } else {
      failed += 1;
      logger.warn(
        {
          security_id: securityId,
          symbol,
          error: result?.error ?? "no result",
        },
        "No dividend figure for a security"
      );
    }
  }

  const summary = { requested: securities.length, updated, failed };
  logger.info(
    { ...summary, source: provider.name },
    "Security dividends refreshed"
  );
  return summary;
}
