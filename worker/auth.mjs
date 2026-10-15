import { HttpError, readJson } from "./helpers.mjs";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function decodeBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return decoder.decode(bytes);
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function encodeJson(value) {
  return encodeBase64Url(encoder.encode(JSON.stringify(value)));
}

async function signSession(claims, env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new HttpError(503, "AUTH_NOT_CONFIGURED");
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const payload = encodeJson(claims);
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${payload}`))));
  return `${header}.${payload}.${signature}`;
}

async function ensureIdentity(env, { tenantId, userId, email, displayName }) {
  if (!env.DB) throw new HttpError(503, "D1_NOT_CONFIGURED");
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO tenants (id, name, created_at) VALUES (?, ?, ?)").bind(tenantId, email, now),
    env.DB.prepare("INSERT OR IGNORE INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)").bind(userId, email, displayName || email, now),
    env.DB.prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").bind(tenantId, userId, now)
  ]);
}

export function validateGoogleAudience(profile, env) {
  const allowedClients = String(env.GOOGLE_OAUTH_CLIENT_IDS || env.GOOGLE_OAUTH_CLIENT_ID || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!allowedClients.length) throw new HttpError(503, "GOOGLE_AUTH_NOT_CONFIGURED");
  const audience = profile.aud || profile.audience || profile.azp;
  if (!audience || !allowedClients.includes(audience)) throw new HttpError(401, "INVALID_GOOGLE_AUDIENCE");
  return audience;
}

export async function exchangeGoogleSession(request, env) {
  const body = await readJson(request, 16_384);
  if (typeof body.accessToken !== "string" || body.accessToken.length < 20 || body.accessToken.length > 4096) throw new HttpError(400, "INVALID_INPUT");
  const response = await fetch("https://oauth2.googleapis.com/tokeninfo", { headers: { authorization: `Bearer ${body.accessToken}` } });
  if (!response.ok) throw new HttpError(401, "INVALID_GOOGLE_TOKEN");
  const profile = await response.json();
  const googleUserId = profile.sub || profile.user_id;
  const verifiedEmail = profile.email_verified === "true" || profile.verified_email === "true" || profile.email_verified === true || profile.verified_email === true;
  if (!googleUserId || !profile.email || !verifiedEmail) throw new HttpError(401, "UNVERIFIED_GOOGLE_ACCOUNT");
  validateGoogleAudience(profile, env);
  const tenantId = `personal:${googleUserId}`;
  const userId = `google:${googleUserId}`;
  await ensureIdentity(env, { tenantId, userId, email: profile.email, displayName: profile.email });
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = Math.min(3600, Math.max(300, Number(env.SESSION_TTL_SECONDS) || 3600));
  const token = await signSession({
    sub: userId,
    tenant_id: tenantId,
    roles: ["owner"],
    iat: now,
    nbf: now - 5,
    exp: now + expiresIn,
    ...(env.SESSION_ISSUER ? { iss: env.SESSION_ISSUER } : {}),
    ...(env.SESSION_AUDIENCE ? { aud: env.SESSION_AUDIENCE } : {})
  }, env);
  return { token, expiresAt: new Date((now + expiresIn) * 1000).toISOString(), user: { id: userId, email: profile.email }, tenant: { id: tenantId } };
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifySession(request, env) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "AUTH_REQUIRED");

  if (env.DEVELOPMENT_AUTH === "true") {
    if (env.ENVIRONMENT === "production") throw new HttpError(500, "INSECURE_AUTH_CONFIGURATION");
    if (!env.DEVELOPMENT_TOKEN || !timingSafeEqual(match[1], env.DEVELOPMENT_TOKEN)) throw new HttpError(401, "INVALID_SESSION");
    if (!env.DEVELOPMENT_TENANT_ID || !env.DEVELOPMENT_USER_ID) throw new HttpError(500, "AUTH_NOT_CONFIGURED");
    if (env.DB) await ensureIdentity(env, { tenantId: env.DEVELOPMENT_TENANT_ID, userId: env.DEVELOPMENT_USER_ID, email: `${env.DEVELOPMENT_USER_ID}@development.invalid`, displayName: "Development User" });
    return { tenantId: env.DEVELOPMENT_TENANT_ID, userId: env.DEVELOPMENT_USER_ID, roles: ["owner"] };
  }

  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new HttpError(503, "AUTH_NOT_CONFIGURED");
  const parts = match[1].split(".");
  if (parts.length !== 3) throw new HttpError(401, "INVALID_SESSION");
  const [encodedHeader, encodedPayload, signature] = parts;
  let header;
  let claims;
  try {
    header = JSON.parse(decodeBase64Url(encodedHeader));
    claims = JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    throw new HttpError(401, "INVALID_SESSION");
  }
  if (header.alg !== "HS256" || header.typ !== "JWT") throw new HttpError(401, "INVALID_SESSION");
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${encodedHeader}.${encodedPayload}`))));
  if (!timingSafeEqual(expected, signature)) throw new HttpError(401, "INVALID_SESSION");
  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp <= now || (claims.nbf && claims.nbf > now)) throw new HttpError(401, "SESSION_EXPIRED");
  if (env.SESSION_ISSUER && claims.iss !== env.SESSION_ISSUER) throw new HttpError(401, "INVALID_SESSION");
  if (env.SESSION_AUDIENCE) {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(env.SESSION_AUDIENCE)) throw new HttpError(401, "INVALID_SESSION");
  }
  if (!claims.sub || !claims.tenant_id) throw new HttpError(401, "INVALID_SESSION");
  let roles = Array.isArray(claims.roles) ? claims.roles : [];
  if (env.DB) {
    const membership = await env.DB.prepare("SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?").bind(claims.tenant_id, claims.sub).first();
    if (!membership) throw new HttpError(403, "MEMBERSHIP_REVOKED");
    roles = [membership.role];
  }
  return { tenantId: claims.tenant_id, userId: claims.sub, roles };
}
