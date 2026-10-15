import { exchangeGoogleSession, verifySession } from "./auth.mjs";
import { chat } from "./chat.mjs";
import { HttpError, corsHeaders, json } from "./helpers.mjs";
import { createDocument, deleteDocument, listDocuments, readDocument, reindexDocument, searchKnowledge } from "./knowledge.mjs";

async function health(env) {
  const bindings = { d1: Boolean(env.DB), originals: Boolean(env.ORIGINALS), artifacts: Boolean(env.ARTIFACTS), vectorize: Boolean(env.VECTORIZE), ai: Boolean(env.AI || (env.EMBEDDING_BASE_URL && env.EMBEDDING_API_KEY)) };
  return { status: Object.values(bindings).every(Boolean) ? "ok" : "degraded", service: "pesat-rag-worker", bindings };
}

async function getJob(env, session, id) {
  if (!env.DB) throw new HttpError(503, "D1_NOT_CONFIGURED");
  const job = await env.DB.prepare("SELECT id, type, status, progress, result_json, error_code, created_at, updated_at, completed_at FROM tasks WHERE id = ? AND tenant_id = ? AND owner_user_id = ?")
    .bind(id, session.tenantId, session.userId).first();
  if (!job) throw new HttpError(404, "JOB_NOT_FOUND");
  job.result = job.result_json ? JSON.parse(job.result_json) : null;
  delete job.result_json;
  return { job };
}

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/health") return health(env);
  if (request.method === "POST" && url.pathname === "/api/auth/google") {
    if (env.AUTH_RATE_LIMITER) {
      const rate = await env.AUTH_RATE_LIMITER.limit({ key: request.headers.get("cf-connecting-ip") || "unknown" });
      if (!rate.success) throw new HttpError(429, "RATE_LIMITED");
    }
    return exchangeGoogleSession(request, env);
  }
  const session = await verifySession(request, env);
  if (env.API_RATE_LIMITER) {
    const rate = await env.API_RATE_LIMITER.limit({ key: `${session.tenantId}:${session.userId}` });
    if (!rate.success) throw new HttpError(429, "RATE_LIMITED");
  }

  if (request.method === "POST" && url.pathname === "/api/knowledge/documents") return createDocument(request, env, session);
  if (request.method === "GET" && url.pathname === "/api/knowledge/documents") return listDocuments(url, env, session);
  if (request.method === "POST" && url.pathname === "/api/knowledge/search") return searchKnowledge(request, env, session);
  if (request.method === "POST" && url.pathname === "/api/chat") return chat(request, env, session);

  let match = url.pathname.match(/^\/api\/knowledge\/documents\/([^/]+)$/);
  if (match && request.method === "GET") return readDocument(env, session, decodeURIComponent(match[1]), url);
  if (match && request.method === "DELETE") return deleteDocument(env, session, decodeURIComponent(match[1]));
  match = url.pathname.match(/^\/api\/knowledge\/reindex\/([^/]+)$/);
  if (match && request.method === "POST") return reindexDocument(env, session, decodeURIComponent(match[1]));
  match = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (match && request.method === "GET") return getJob(env, session, decodeURIComponent(match[1]));

  throw new HttpError(404, "NOT_FOUND");
}

export default {
  async fetch(request, env) {
    let cors = {};
    try {
      cors = corsHeaders(request, env);
      if (request.method === "OPTIONS") {
        if (!request.headers.get("origin")) throw new HttpError(400, "ORIGIN_REQUIRED");
        return new Response(null, { status: 204, headers: cors });
      }
      const data = await route(request, env);
      return json(data, 200, cors);
    } catch (error) {
      if (error instanceof HttpError) return json({ success: false, error: error.code, message: error.message }, error.status, cors);
      console.error("Unhandled worker error", error?.stack || error);
      return json({ success: false, error: "INTERNAL_ERROR" }, 500, cors);
    }
  }
};
