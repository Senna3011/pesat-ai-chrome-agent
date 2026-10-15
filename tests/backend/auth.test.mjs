import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { validateGoogleAudience, verifySession } from "../../worker/auth.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.atob) globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");
if (!globalThis.btoa) globalThis.btoa = (value) => Buffer.from(value, "binary").toString("base64");

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

async function token(secret, claims) {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode(claims);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`))).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

const secret = "test-session-secret-at-least-32-bytes";

test("verified claims supply tenant and user", async () => {
  const jwt = await token(secret, { sub: "user-1", tenant_id: "tenant-1", exp: Math.floor(Date.now() / 1000) + 60 });
  const session = await verifySession(new Request("https://example.test", { headers: { authorization: `Bearer ${jwt}` } }), { SESSION_SECRET: secret });
  assert.deepEqual(session, { tenantId: "tenant-1", userId: "user-1", roles: [] });
});

test("short session secret fails closed", async () => {
  const jwt = await token("short", { sub: "user-1", tenant_id: "tenant-1", exp: Math.floor(Date.now() / 1000) + 60 });
  await assert.rejects(() => verifySession(new Request("https://example.test", { headers: { authorization: `Bearer ${jwt}` } }), { SESSION_SECRET: "short" }), { code: "AUTH_NOT_CONFIGURED" });
});

test("invalid signature fails closed", async () => {
  const jwt = await token("wrong-session-secret-at-least-32-bytes", { sub: "user-1", tenant_id: "tenant-1", exp: Math.floor(Date.now() / 1000) + 60 });
  await assert.rejects(() => verifySession(new Request("https://example.test", { headers: { authorization: `Bearer ${jwt}` } }), { SESSION_SECRET: secret }), { code: "INVALID_SESSION" });
});

test("development auth cannot run in production", async () => {
  const request = new Request("https://example.test", { headers: { authorization: "Bearer dev" } });
  await assert.rejects(() => verifySession(request, { DEVELOPMENT_AUTH: "true", DEVELOPMENT_TOKEN: "dev", ENVIRONMENT: "production" }), { code: "INSECURE_AUTH_CONFIGURATION" });
});

test("Google audience validation fails closed", () => {
  assert.throws(() => validateGoogleAudience({ aud: "client-a" }, {}), { code: "GOOGLE_AUTH_NOT_CONFIGURED" });
  assert.throws(() => validateGoogleAudience({ aud: "client-b" }, { GOOGLE_OAUTH_CLIENT_IDS: "client-a" }), { code: "INVALID_GOOGLE_AUDIENCE" });
  assert.equal(validateGoogleAudience({ aud: "client-b" }, { GOOGLE_OAUTH_CLIENT_IDS: "client-a,client-b" }), "client-b");
});
