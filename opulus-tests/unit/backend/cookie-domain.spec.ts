import { expect, test } from "@playwright/test";
import { getCookieScope } from "../../../opulus-backend/src/cookieDomain.js";

/**
 * Where the session cookie is valid and which passkey relying party goes with
 * it (opulus-backend/src/cookieDomain.ts), from CLIENT_URL and COOKIE_DOMAIN.
 *
 * Test cases:
 * - unset, shares the cookie across the subdomains of the client's last two labels
 * - unset, with an IP address for the client, the cookie is host-only
 * - unset, with a CLIENT_URL that is not a URL, falls back to .opulus.app
 * - "host" makes the cookie host-only, for a Tailscale hostname
 * - a domain, with or without the leading dot, is used as given
 */
test.describe("cookie scope", () => {
  test("unset, shares the cookie across the subdomains of the client's last two labels", () => {
    expect(getCookieScope("https://www.opulus.app")).toEqual({ domain: ".opulus.app", rpID: "opulus.app" });
    expect(getCookieScope("http://localhost:5173", "")).toEqual({ domain: ".localhost", rpID: "localhost" });
  });

  test("unset, with an IP address for the client, the cookie is host-only", () => {
    expect(getCookieScope("https://192.168.1.20:8443")).toEqual({ domain: null, rpID: "192.168.1.20" });
    expect(getCookieScope("https://100.64.0.7")).toEqual({ domain: null, rpID: "100.64.0.7" });
    expect(getCookieScope("https://[fd7a:115c:a1e0::1]").domain).toBeNull();
  });

  test("unset, with a CLIENT_URL that is not a URL, falls back to .opulus.app", () => {
    expect(getCookieScope("not a url")).toEqual({ domain: ".opulus.app", rpID: "opulus.app" });
  });

  test('"host" makes the cookie host-only, for a Tailscale hostname', () => {
    expect(getCookieScope("https://opulus.tail1234.ts.net", "host")).toEqual({
      domain: null,
      rpID: "opulus.tail1234.ts.net",
    });
    expect(getCookieScope("https://opulus.tail1234.ts.net", " HOST ").domain).toBeNull();
  });

  test("a domain, with or without the leading dot, is used as given", () => {
    const expected = { domain: ".tail1234.ts.net", rpID: "tail1234.ts.net" };
    expect(getCookieScope("https://opulus.tail1234.ts.net", "tail1234.ts.net")).toEqual(expected);
    expect(getCookieScope("https://opulus.tail1234.ts.net", ".tail1234.ts.net")).toEqual(expected);
  });
});
