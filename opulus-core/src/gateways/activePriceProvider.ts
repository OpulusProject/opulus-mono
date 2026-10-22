import { ACTIVE_PRICE_PROVIDER } from "../utils/priceProviderName.js";
import type { PriceProvider } from "./priceProvider.js";
import { yahooGateway } from "./yahooGateway.js";

const providers: Record<string, PriceProvider> = {
  [yahooGateway.name]: yahooGateway,
};

/**
 * The provider security prices come from (see `ACTIVE_PRICE_PROVIDER`).
 * Everything that quotes a security uses this.
 */
export const activePriceProvider: PriceProvider =
  providers[ACTIVE_PRICE_PROVIDER]!;
