import { expect, test } from "@playwright/test";
import { uniqueIp, withSession } from "../../../shared/client.js";
import { createAuthedUser, signUp } from "../../../shared/fixtures/index.js";

/** The one origin the API allows: the client the backend runs with (CLIENT_URL, the same in CI and the local runner). */
const CLIENT_ORIGIN = process.env.CLIENT_URL ?? "http://localhost:5173";

/**
 * This file: how the API presents itself to a browser and to an attacker: which
 * origins it answers, how its session cookie is set, and what it says on
 * failure. Black box over HTTP.
 *
 * Test cases:
 * - answers its client's origin, with credentials
 * - answers a preflight from its client for the methods and headers the client uses
 * - gives no CORS permission to any other origin
 * - sets the session cookie HttpOnly, Secure and SameSite=Lax
 * - does not say what it is built with (no X-Powered-By)
 * - answers an unknown route as JSON, not an HTML page that names the framework
 * - answers a malformed JSON body with a 400, not a 500 or a stack trace
 * - does not put internals in a 500
 */
test.describe("HTTP hardening", () => {
  test("answers its client's origin, with credentials", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.get("/api/session", { headers: { ...withSession(cookie), origin: CLIENT_ORIGIN } });

    expect(res.headers()["access-control-allow-origin"]).toBe(CLIENT_ORIGIN);
    expect(res.headers()["access-control-allow-credentials"]).toBe("true");
  });

  test("answers a preflight from its client for the methods and headers the client uses", async ({ request }) => {
    const res = await request.fetch("/api/items", {
      method: "OPTIONS",
      headers: {
        origin: CLIENT_ORIGIN,
        "access-control-request-method": "DELETE",
        "access-control-request-headers": "content-type",
      },
    });

    expect(res.status()).toBeLessThan(300);
    expect(res.headers()["access-control-allow-origin"]).toBe(CLIENT_ORIGIN);
    expect(res.headers()["access-control-allow-methods"]).toContain("DELETE");
    expect(res.headers()["access-control-allow-headers"]?.toLowerCase()).toContain("content-type");
  });

  test("gives no CORS permission to any other origin", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    const evil = "https://evil.example.test";

    const simple = await request.get("/api/session", { headers: { ...withSession(cookie), origin: evil } });
    const preflight = await request.fetch("/api/items", {
      method: "OPTIONS",
      headers: { origin: evil, "access-control-request-method": "DELETE" },
    });

    for (const res of [simple, preflight]) {
      expect(res.headers()["access-control-allow-origin"]).not.toBe(evil);
      expect(res.headers()["access-control-allow-origin"]).not.toBe("*");
    }
  });

  test("sets the session cookie HttpOnly, Secure and SameSite=Lax", async ({ request }) => {
    const user = await signUp(request);

    const res = await request.post("/api/auth/sign-in/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: user.email, password: user.password },
    });

    const cookies = res
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value);
    const session = cookies.find((value) => value.startsWith("opulus.session_token="));
    expect(session, cookies.join("\n")).toBeDefined();
    expect(session).toMatch(/;\s*HttpOnly/i);
    expect(session).toMatch(/;\s*Secure/i);
    expect(session).toMatch(/;\s*SameSite=Lax/i);
  });

  test("does not say what it is built with (no X-Powered-By)", async ({ request }) => {
    const res = await request.get("/health");

    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });

  test("answers an unknown route as JSON, not an HTML page that names the framework", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.get("/api/this-route-does-not-exist", { headers: withSession(cookie) });

    expect(res.status()).toBe(404);
    expect(res.headers()["content-type"]).toContain("application/json");
    expect(await res.text()).not.toMatch(/Express|Cannot GET|<html/i);
  });

  test("answers a malformed JSON body with a 400, not a 500 or a stack trace", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.post("/api/link-tokens", {
      headers: { ...withSession(cookie), "content-type": "application/json" },
      data: Buffer.from("{ this is not json"),
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).not.toMatch(/SyntaxError|at .*\.(js|ts):\d+/);
  });

  test("does not put internals in a 500", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    // An id that is not a valid database id of any kind must not leak how it failed.
    const res = await request.delete(`/api/items/${"x".repeat(5000)}`, { headers: withSession(cookie) });

    expect(res.status()).toBeLessThan(500);
    expect(await res.text()).not.toMatch(/prisma|postgres|SELECT |at .*\.(js|ts):\d+/i);
  });
});
