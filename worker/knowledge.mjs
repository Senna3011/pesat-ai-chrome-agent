import { embedTexts } from "./embeddings.mjs";
import { HttpError, LIMITS, chunkDocument, newId, normalizeMimeType, normalizeText, parsePositiveInt, readJson, requireString, selectContext, sha256 } from "./helpers.mjs";

const SUPPORTED_MIME = new Set(["text/plain", "text/markdown", "text/html", "text/csv"]);

function requireBindings(env) {
  if (!env.DB || !env.ORIGINALS || !env.VECTORIZE) throw new HttpError(503, "KNOWLEDGE_BINDINGS_NOT_CONFIGURED");
}

export function normalizeSourceTypes(value) {
  const allowed = new Set(["upload", "page", "text"]);
  const sourceTypes = Array.isArray(value) ? [...new Set(value.map(String))] : [];
  if (sourceTypes.some((type) => !allowed.has(type))) throw new HttpError(400, "INVALID_SOURCE_TYPE");
  return sourceTypes;
}

export function buildKnowledgeFilter(tenantId, sourceTypes = []) {
  return sourceTypes.length
    ? { $and: [{ tenant_id: { $eq: tenantId } }, { source_type: { $in: sourceTypes } }] }
    : { tenant_id: { $eq: tenantId } };
}

async function audit(env, session, action, resourceType, resourceId, details = {}) {
  await env.DB.prepare("INSERT INTO audit_events (id, tenant_id, actor_user_id, action, resource_type, resource_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(newId("aud"), session.tenantId, session.userId, action, resourceType, resourceId, JSON.stringify(details), new Date().toISOString()).run();
}

async function getDocument(env, session, id) {
  const document = await env.DB.prepare("SELECT id, title, source_type, source_url, mime_type, content_hash, version, status, byte_size, metadata_json, created_at, updated_at FROM documents WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL")
    .bind(id, session.tenantId).first();
  if (!document) throw new HttpError(404, "DOCUMENT_NOT_FOUND");
  document.metadata = JSON.parse(document.metadata_json || "{}");
  delete document.metadata_json;
  return document;
}

export async function createDocument(request, env, session) {
  requireBindings(env);
  const body = await readJson(request, LIMITS.documentBytes + 32_768);
  const title = requireString(body.title, "title", 300);
  const content = requireString(body.content, "content", LIMITS.documentBytes);
  const mimeType = normalizeMimeType(body.mimeType);
  if (!SUPPORTED_MIME.has(mimeType)) throw new HttpError(415, "UNSUPPORTED_DOCUMENT_TYPE");
  const sourceType = ["upload", "page", "text"].includes(body.sourceType) ? body.sourceType : "text";
  const sourceUrl = requireString(body.sourceUrl, "sourceUrl", 2048, { optional: true });
  const normalized = normalizeText(content, mimeType);
  if (!normalized) throw new HttpError(400, "EMPTY_DOCUMENT");
  const byteSize = new TextEncoder().encode(content).byteLength;
  if (byteSize > LIMITS.documentBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE");
  const contentHash = await sha256(normalized);
  const existing = await env.DB.prepare("SELECT id, status FROM documents WHERE tenant_id = ? AND content_hash = ? AND deleted_at IS NULL").bind(session.tenantId, contentHash).first();
  if (existing) return { document: await getDocument(env, session, existing.id), idempotent: true };

  const id = newId("doc");
  const now = new Date().toISOString();
  const r2Key = `${session.tenantId}/originals/${id}`;
  const chunks = await chunkDocument(normalized, id, 1);
  if (chunks.length > LIMITS.maxDocumentChunks) throw new HttpError(413, "DOCUMENT_REQUIRES_ASYNC_INGESTION");
  const vectors = await embedTexts(chunks.map((chunk) => chunk.content), env);
  await env.ORIGINALS.put(r2Key, content, { httpMetadata: { contentType: mimeType }, customMetadata: { tenantId: session.tenantId, documentId: id, contentHash } });

  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO documents (id, tenant_id, owner_user_id, title, source_type, source_url, mime_type, content_hash, r2_key, version, status, byte_size, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'indexing', ?, ?, ?, ?)")
        .bind(id, session.tenantId, session.userId, title, sourceType, sourceUrl || null, mimeType, contentHash, r2Key, byteSize, JSON.stringify(body.metadata || {}), now, now),
      ...chunks.map((chunk) => env.DB.prepare("INSERT INTO chunks (id, tenant_id, document_id, chunk_index, content, content_hash, char_start, char_end, token_estimate, vector_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(chunk.id, session.tenantId, id, chunk.index, chunk.content, chunk.contentHash, chunk.charStart, chunk.charEnd, Math.ceil(chunk.content.length / 4), chunk.id, now))
    ]);
    await env.VECTORIZE.upsert(chunks.map((chunk, index) => ({
      id: chunk.id,
      values: vectors[index],
      metadata: { tenant_id: session.tenantId, document_id: id, source_type: sourceType, document_version: 1 }
    })));
    await env.DB.prepare("UPDATE documents SET status = 'ready', updated_at = ? WHERE id = ? AND tenant_id = ?").bind(new Date().toISOString(), id, session.tenantId).run();
    await audit(env, session, "document.create", "document", id, { chunkCount: chunks.length, contentHash });
  } catch (error) {
    await Promise.allSettled([env.ORIGINALS.delete(r2Key), env.VECTORIZE.deleteByIds(chunks.map((chunk) => chunk.id))]);
    await env.DB.prepare("DELETE FROM documents WHERE id = ? AND tenant_id = ?").bind(id, session.tenantId).run().catch(() => {});
    throw error;
  }
  return { document: await getDocument(env, session, id), idempotent: false };
}

export async function listDocuments(url, env, session) {
  requireBindings(env);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 50, 100);
  const cursor = url.searchParams.get("cursor") || "9999-12-31T23:59:59.999Z";
  const result = await env.DB.prepare("SELECT id, title, source_type, source_url, mime_type, content_hash, version, status, byte_size, created_at, updated_at FROM documents WHERE tenant_id = ? AND deleted_at IS NULL AND created_at < ? ORDER BY created_at DESC LIMIT ?")
    .bind(session.tenantId, cursor, limit + 1).all();
  const rows = result.results || [];
  return { documents: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1].created_at : null };
}

export async function readDocument(env, session, id, url = null) {
  requireBindings(env);
  const document = await getDocument(env, session, id);
  const chunkId = url?.searchParams.get("chunkId") || "";
  if (!chunkId) return { document };
  const chunk = await env.DB.prepare("SELECT id, document_id, content, char_start, char_end, chunk_index FROM chunks WHERE id = ? AND document_id = ? AND tenant_id = ?")
    .bind(chunkId, id, session.tenantId).first();
  if (!chunk) throw new HttpError(404, "CHUNK_NOT_FOUND");
  return {
    sourceId: document.id,
    chunkId: chunk.id,
    title: document.title,
    url: document.source_url,
    sourceType: document.source_type,
    documentVersion: document.version,
    span: { start: chunk.char_start, end: chunk.char_end },
    content: chunk.content,
    trust: "untrusted_document_content"
  };
}

export async function deleteDocument(env, session, id) {
  requireBindings(env);
  const document = await env.DB.prepare("SELECT id, r2_key FROM documents WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL").bind(id, session.tenantId).first();
  if (!document) throw new HttpError(404, "DOCUMENT_NOT_FOUND");
  const chunkRows = await env.DB.prepare("SELECT vector_id FROM chunks WHERE document_id = ? AND tenant_id = ?").bind(id, session.tenantId).all();
  const vectorIds = (chunkRows.results || []).map((row) => row.vector_id);
  if (vectorIds.length) await env.VECTORIZE.deleteByIds(vectorIds);
  if (document.r2_key) await env.ORIGINALS.delete(document.r2_key);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM chunks WHERE document_id = ? AND tenant_id = ?").bind(id, session.tenantId),
    env.DB.prepare("UPDATE documents SET deleted_at = ?, status = 'deleted', updated_at = ? WHERE id = ? AND tenant_id = ?").bind(new Date().toISOString(), new Date().toISOString(), id, session.tenantId)
  ]);
  await audit(env, session, "document.delete", "document", id);
  return { deleted: true, id };
}

export async function reindexDocument(env, session, id) {
  requireBindings(env);
  const document = await env.DB.prepare("SELECT id, title, source_type, mime_type, content_hash, r2_key, version FROM documents WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL").bind(id, session.tenantId).first();
  if (!document) throw new HttpError(404, "DOCUMENT_NOT_FOUND");
  const object = await env.ORIGINALS.get(document.r2_key);
  if (!object) throw new HttpError(409, "ORIGINAL_NOT_FOUND");
  const normalized = normalizeText(await object.text(), document.mime_type);
  const version = document.version + 1;
  const chunks = await chunkDocument(normalized, id, version);
  if (chunks.length > LIMITS.maxDocumentChunks) throw new HttpError(413, "DOCUMENT_REQUIRES_ASYNC_INGESTION");
  const vectors = await embedTexts(chunks.map((chunk) => chunk.content), env);
  const oldRows = await env.DB.prepare("SELECT vector_id FROM chunks WHERE document_id = ? AND tenant_id = ?").bind(id, session.tenantId).all();
  const oldIds = (oldRows.results || []).map((row) => row.vector_id);
  await env.VECTORIZE.upsert(chunks.map((chunk, index) => ({ id: chunk.id, values: vectors[index], metadata: { tenant_id: session.tenantId, document_id: id, source_type: document.source_type, document_version: version } })));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM chunks WHERE document_id = ? AND tenant_id = ?").bind(id, session.tenantId),
    ...chunks.map((chunk) => env.DB.prepare("INSERT INTO chunks (id, tenant_id, document_id, chunk_index, content, content_hash, char_start, char_end, token_estimate, vector_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(chunk.id, session.tenantId, id, chunk.index, chunk.content, chunk.contentHash, chunk.charStart, chunk.charEnd, Math.ceil(chunk.content.length / 4), chunk.id, new Date().toISOString())),
    env.DB.prepare("UPDATE documents SET version = ?, status = 'ready', updated_at = ? WHERE id = ? AND tenant_id = ?").bind(version, new Date().toISOString(), id, session.tenantId)
  ]);
  if (oldIds.length) await env.VECTORIZE.deleteByIds(oldIds);
  await audit(env, session, "document.reindex", "document", id, { version, chunkCount: chunks.length });
  return { document: await getDocument(env, session, id) };
}

export async function searchKnowledge(request, env, session) {
  requireBindings(env);
  const body = await readJson(request);
  const query = requireString(body.query, "query", LIMITS.queryChars);
  const topK = Math.min(parsePositiveInt(body.topK, 8, LIMITS.topK), LIMITS.topK);
  const sourceTypes = normalizeSourceTypes(body.sourceTypes);
  const filter = buildKnowledgeFilter(session.tenantId, sourceTypes);
  const [vector] = await embedTexts([query], env);
  const result = await env.VECTORIZE.query(vector, { topK, returnMetadata: true, filter });
  const ids = (result.matches || []).map((match) => match.id);
  if (!ids.length) return { query, sources: [] };
  const placeholders = ids.map(() => "?").join(",");
  const rows = await env.DB.prepare(`SELECT c.id, c.document_id, c.content, c.content_hash, c.char_start, c.char_end, c.chunk_index, d.title, d.source_url, d.source_type, d.version FROM chunks c JOIN documents d ON d.id = c.document_id AND d.tenant_id = c.tenant_id WHERE c.tenant_id = ? AND d.deleted_at IS NULL AND c.id IN (${placeholders})`)
    .bind(session.tenantId, ...ids).all();
  const scores = new Map((result.matches || []).map((match) => [match.id, match.score]));
  const ordered = (rows.results || []).map((row) => ({ ...row, score: scores.get(row.id) || 0 })).sort((a, b) => b.score - a.score);
  const selected = selectContext(ordered, Math.min(parsePositiveInt(body.contextChars, LIMITS.contextChars, LIMITS.contextChars), LIMITS.contextChars));
  return {
    query,
    sources: selected.map((row, index) => ({
      citation: `S${index + 1}`,
      sourceId: row.document_id,
      chunkId: row.id,
      title: row.title,
      url: row.source_url,
      sourceType: row.source_type,
      documentVersion: row.version,
      span: { start: row.char_start, end: row.char_end },
      score: row.score,
      retrievedAt: new Date().toISOString(),
      content: row.content,
      trust: "untrusted_document_content"
    }))
  };
}
