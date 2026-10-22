/**
 * The market-data provider security prices come from, by the name stored in
 * `security_price.source`. Changing it (to a licensed provider, once there is
 * one) means choosing its gateway in `activePriceProvider`, and clearing
 * `security.priceBackfilledAt` so every security's history is fetched again.
 */
export const ACTIVE_PRICE_PROVIDER = "yahoo";
