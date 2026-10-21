import { expect, test } from "@playwright/test";
import { resolveSymbol } from "@opulus/core";

const security = (ticker: string | null, mic: string | null, type = "etf", isCashEquivalent = false) => ({
  tickerSymbol: ticker,
  marketIdentifierCode: mic,
  type,
  isCashEquivalent,
});

/**
 * The symbol Yahoo knows a security by, worked out from Plaid's ticker and
 * exchange code (opulus-core/src/utils/securitySymbol.ts). The cases are the
 * securities a real Wealthsimple account came back with.
 *
 * Test cases:
 * - gives a bare ticker on the Toronto exchange the .TO suffix
 * - keeps a suffix the ticker already has, and does not double it
 * - gives a ticker on a US exchange, or with no exchange, as it is
 * - gives other exchanges their suffix (TSX Venture, Cboe Canada, London)
 * - writes a share class with a dash, before the suffix (BRK.B, BAM.A on the TSX)
 * - leaves cash, options and bonds unpriced
 * - leaves a security with no ticker, or with a cash-style ticker, unpriced
 * - does not guess for an exchange it has no suffix for
 */
test.describe("resolveSymbol", () => {
  test("gives a bare ticker on the Toronto exchange the .TO suffix", () => {
    expect(resolveSymbol(security("VEQT", "XTSE"))).toEqual({ status: "active", symbol: "VEQT.TO" });
    expect(resolveSymbol(security("ZGLD", "XTSE"))).toEqual({ status: "active", symbol: "ZGLD.TO" });
  });

  test("keeps a suffix the ticker already has, and does not double it", () => {
    expect(resolveSymbol(security("TD.TO", null, "equity"))).toEqual({ status: "active", symbol: "TD.TO" });
    expect(resolveSymbol(security("TD.TO", "XTSE", "equity"))).toEqual({ status: "active", symbol: "TD.TO" });
  });

  test("gives a ticker on a US exchange, or with no exchange, as it is", () => {
    expect(resolveSymbol(security("CLIP", "ARCX"))).toEqual({ status: "active", symbol: "CLIP" });
    expect(resolveSymbol(security("AAPL", "XNAS", "equity"))).toEqual({ status: "active", symbol: "AAPL" });
    expect(resolveSymbol(security("AAPL", null, "equity"))).toEqual({ status: "active", symbol: "AAPL" });
  });

  test("gives other exchanges their suffix (TSX Venture, Cboe Canada, London)", () => {
    expect(resolveSymbol(security("ABC", "XTSX", "equity")).symbol).toBe("ABC.V");
    expect(resolveSymbol(security("XYZ", "NEOE")).symbol).toBe("XYZ.NE");
    expect(resolveSymbol(security("VOD", "XLON", "equity")).symbol).toBe("VOD.L");
  });

  test("writes a share class with a dash, before the suffix (BRK.B, BAM.A on the TSX)", () => {
    expect(resolveSymbol(security("BRK.B", "XNYS", "equity")).symbol).toBe("BRK-B");
    expect(resolveSymbol(security("BAM.A", "XTSE", "equity")).symbol).toBe("BAM-A.TO");
    expect(resolveSymbol(security("BAM.A.TO", null, "equity")).symbol).toBe("BAM-A.TO");
  });

  test("leaves cash, options and bonds unpriced", () => {
    for (const type of ["cash", "derivative", "fixed income"]) {
      expect(resolveSymbol(security("XYZ", "XTSE", type))).toMatchObject({ status: "unsupported", symbol: null });
    }
    expect(resolveSymbol(security("MMF", "XTSE", "etf", true))).toMatchObject({ status: "unsupported" });
  });

  test("leaves a security with no ticker, or with a cash-style ticker, unpriced", () => {
    expect(resolveSymbol(security(null, "XTSE"))).toMatchObject({ status: "unsupported", reason: "no ticker" });
    expect(resolveSymbol(security("", null))).toMatchObject({ status: "unsupported" });
    expect(resolveSymbol(security("CUR:CAD", null, "etf"))).toMatchObject({ status: "unsupported" });
  });

  test("does not guess for an exchange it has no suffix for", () => {
    expect(resolveSymbol(security("ABC", "XJPX", "equity"))).toMatchObject({ status: "unsupported", symbol: null });
  });
});
