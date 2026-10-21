/**
 * The market-data provider security prices come from, by the name stored in
 * `security_price.source`. Changing it (to a licensed provider, once there is
 * one) means choosing its gateway in `activePriceProvider`, and resetting the
 * securities' price columns (`priceSymbol` and the rest, which are for one
 * provider) so they are tracked and backfilled again.
 */
export const ACTIVE_PRICE_PROVIDER = "yahoo";
