import {
  createHash,
  createSign,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from "node:crypto";
import { type APIRequestContext } from "@playwright/test";
import { Encoder } from "cbor-x";
import { expectOk } from "../assertions.js";
import { cookiesFrom, uniqueIp } from "../client.js";

/**
 * A software passkey authenticator, so the passkey endpoints can be tested
 * without a browser or a device: it makes the registration and authentication
 * responses a real authenticator would (WebAuthn, ES256, "none" attestation).
 *
 * The relying party and origin must match the backend's config: the test
 * backend runs with CLIENT_URL=http://localhost:5173, so the relying party id is
 * "localhost".
 */
export const RP_ID = "localhost";
export const ORIGIN = process.env.CLIENT_URL ?? "http://localhost:5173";

// Plain CBOR: cbor-x's default "records" mode adds its own non-standard tags.
const encode = (value: unknown) =>
  new Encoder({ useRecords: false, mapsAsObjects: false }).encode(value);

const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest();
const b64url = (data: Buffer) => data.toString("base64url");

export interface VirtualAuthenticator {
  credentialId: Buffer;
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** The signature counter, which grows with each use. */
  counter: number;
}

export function createVirtualAuthenticator(): VirtualAuthenticator {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  return { credentialId: randomBytes(32), privateKey, publicKey, counter: 0 };
}

/** Authenticator data flags: user present, user verified, attested credential. */
const UP = 0x01;
const UV = 0x04;
const AT = 0x40;

function clientDataJson(type: string, challenge: string) {
  return Buffer.from(
    JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }),
  );
}

/** What the browser hands the server after `navigator.credentials.create()`. */
export function registrationResponse(
  authenticator: VirtualAuthenticator,
  options: { challenge: string },
  { userVerified = true }: { userVerified?: boolean } = {},
) {
  const jwk = authenticator.publicKey.export({ format: "jwk" });
  const coseKey = encode(
    new Map<number, unknown>([
      [1, 2], // key type: EC2
      [3, -7], // algorithm: ES256
      [-1, 1], // curve: P-256
      [-2, Buffer.from(jwk.x!, "base64url")],
      [-3, Buffer.from(jwk.y!, "base64url")],
    ]),
  );
  const idLength = Buffer.alloc(2);
  idLength.writeUInt16BE(authenticator.credentialId.length);
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(authenticator.counter);
  const authData = Buffer.concat([
    sha256(RP_ID),
    Buffer.from([UP | AT | (userVerified ? UV : 0)]),
    counter,
    Buffer.alloc(16), // aaguid: none
    idLength,
    authenticator.credentialId,
    coseKey,
  ]);
  return {
    id: b64url(authenticator.credentialId),
    rawId: b64url(authenticator.credentialId),
    type: "public-key",
    response: {
      clientDataJSON: b64url(clientDataJson("webauthn.create", options.challenge)),
      attestationObject: b64url(
        Buffer.from(
          // Maps, not objects: cbor-x writes objects with a 16-bit length, which
          // the server's strict CBOR reader refuses.
          encode(
            new Map<string, unknown>([
              ["fmt", "none"],
              ["attStmt", new Map()],
              ["authData", authData],
            ]),
          ),
        ),
      ),
      transports: ["internal"],
    },
    clientExtensionResults: {},
  };
}

/** What the browser hands the server after `navigator.credentials.get()`. */
export function authenticationResponse(
  authenticator: VirtualAuthenticator,
  options: { challenge: string },
  { userVerified = true }: { userVerified?: boolean } = {},
) {
  authenticator.counter += 1;
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(authenticator.counter);
  const authData = Buffer.concat([
    sha256(RP_ID),
    Buffer.from([UP | (userVerified ? UV : 0)]),
    counter,
  ]);
  const clientData = clientDataJson("webauthn.get", options.challenge);
  const signature = createSign("SHA256")
    .update(Buffer.concat([authData, sha256(clientData)]))
    .sign(authenticator.privateKey);
  return {
    id: b64url(authenticator.credentialId),
    rawId: b64url(authenticator.credentialId),
    type: "public-key",
    response: {
      authenticatorData: b64url(authData),
      clientDataJSON: b64url(clientData),
      signature: b64url(signature),
    },
    clientExtensionResults: {},
  };
}

/**
 * Register a passkey for the signed-in user through the two endpoints the
 * browser uses: ask for options (which sets a challenge cookie), answer them.
 * Returns the stored passkey.
 */
export async function registerPasskey(
  request: APIRequestContext,
  sessionCookie: string,
  authenticator: VirtualAuthenticator,
  name = "Test passkey",
) {
  const headers = { "x-forwarded-for": uniqueIp() };
  const optionsRes = await request.get("/api/auth/passkey/generate-register-options", {
    headers: { ...headers, cookie: sessionCookie },
  });
  await expectOk(optionsRes);
  const options = await optionsRes.json();

  const res = await request.post("/api/auth/passkey/verify-registration", {
    headers: {
      ...headers,
      cookie: `${sessionCookie}; ${cookiesFrom(optionsRes)}`,
    },
    data: { response: registrationResponse(authenticator, options), name },
  });
  await expectOk(res);
  return res.json();
}

/**
 * Sign in with a passkey: ask for options, answer them. Returns the response of
 * the verification (which sets the session cookie).
 */
export async function signInWithPasskey(
  request: APIRequestContext,
  authenticator: VirtualAuthenticator,
  { userVerified = true }: { userVerified?: boolean } = {},
) {
  const headers = { "x-forwarded-for": uniqueIp() };
  const optionsRes = await request.get(
    "/api/auth/passkey/generate-authenticate-options",
    { headers },
  );
  await expectOk(optionsRes);
  const options = await optionsRes.json();
  return request.post("/api/auth/passkey/verify-authentication", {
    headers: { ...headers, cookie: cookiesFrom(optionsRes) },
    data: { response: authenticationResponse(authenticator, options, { userVerified }) },
  });
}
