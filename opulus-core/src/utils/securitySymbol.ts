/** What a security is, as far as finding its price goes (a subset of `Security`). */
export interface SymbolInput {
  tickerSymbol: string | null;
  /** The ISO 10383 code of the exchange it trades on, if Plaid knows it. */
  marketIdentifierCode: string | null;
  /** Plaid's type: equity, etf, mutual fund, fixed income, derivative, cash, ... */
  type: string | null;
  isCashEquivalent: boolean;
}

export type SymbolResolution =
  | { status: "active"; symbol: string }
  | { status: "unsupported"; symbol: null; reason: string };

/** Exchanges whose symbols Yahoo uses bare: the US ones. */
const US_EXCHANGES = new Set([
  "XNAS", // Nasdaq
  "XNYS", // NYSE
  "ARCX", // NYSE Arca
  "XASE", // NYSE American
  "BATS", // Cboe BZX
  "IEXG", // IEX
  "XNMS", // Nasdaq National Market
  "XNCM", // Nasdaq Capital Market
  "XNGS", // Nasdaq Global Select
]);

/** Exchanges whose symbols Yahoo suffixes, and the suffix. */
const SUFFIXES: Record<string, string> = {
  XTSE: ".TO", // Toronto
  XTSX: ".V", // TSX Venture
  NEOE: ".NE", // Cboe Canada (NEO)
  XCNQ: ".CN", // Canadian Securities Exchange
  XLON: ".L", // London
  XETR: ".DE", // Xetra
  XPAR: ".PA", // Paris
  XAMS: ".AS", // Amsterdam
  XASX: ".AX", // Australia
  XHKG: ".HK", // Hong Kong
};

/** Types with no price per unit to look up. */
const UNPRICED_TYPES = new Set(["cash", "derivative", "fixed income"]);

const unsupported = (reason: string): SymbolResolution => ({
  status: "unsupported",
  symbol: null,
  reason,
});

/**
 * The symbol Yahoo Finance knows a security by, worked out from Plaid's ticker
 * and exchange code, or why it cannot be priced. Plaid's tickers are not
 * uniform: some carry a Yahoo-style suffix already (`TD.TO`), some are bare with
 * the exchange given separately (`VEQT` on XTSE), and share classes use a dot
 * (`BRK.B`) where Yahoo uses a dash (`BRK-B`).
 *
 * Cash, options and bonds are not priced; a security with no ticker, or on an
 * exchange we have no suffix for, is left alone rather than guessed.
 */
export function resolveSymbol(input: SymbolInput): SymbolResolution {
  const { tickerSymbol, marketIdentifierCode, type, isCashEquivalent } = input;
  if (isCashEquivalent || (type && UNPRICED_TYPES.has(type))) {
    return unsupported(`${type ?? "cash"} is not priced`);
  }
  const ticker = tickerSymbol?.trim().toUpperCase();
  if (!ticker || ticker.includes(":")) return unsupported("no ticker");

  // A ticker that already carries a known suffix (TD.TO) is used as it is.
  const known = Object.values(SUFFIXES).find((suffix) =>
    ticker.endsWith(suffix)
  );
  if (known) {
    return {
      status: "active",
      symbol: `${ticker.slice(0, -known.length).replace(/\./g, "-")}${known}`,
    };
  }

  const bare = ticker.replace(/\./g, "-");
  if (!marketIdentifierCode || US_EXCHANGES.has(marketIdentifierCode)) {
    return { status: "active", symbol: bare };
  }
  const suffix = SUFFIXES[marketIdentifierCode];
  if (!suffix) return unsupported(`no suffix for ${marketIdentifierCode}`);
  return { status: "active", symbol: `${bare}${suffix}` };
}
