const encoder = new TextEncoder();

export const LIMITS = Object.freeze({
  jsonBytes: 1_048_576,
  documentBytes: 49_152,
  maxDocumentChunks: 40,
  queryChars: 4_000,
  chatChars: 120_000,
  chunkChars: 1_600,
  chunkOverlap: 160,
  contextChars: 16_000,
  topK: 12,
  maxTokens: 4096
});

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...headers }
  });
}

export class HttpError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function readJson(request, maxBytes = LIMITS.jsonBytes) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json")) throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE");
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE");
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE");
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "INVALID_JSON");
  }
}

export function requireString(value, name, max, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, "INVALID_INPUT", `${name} is required`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, "INVALID_INPUT", `${name} exceeds ${max} characters`);
  return text;
}

export function parsePositiveInt(value, fallback, max) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? Math.min(number, max) : fallback;
}

export function allowedOrigins(env) {
  const configured = String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (env.ALLOWED_EXTENSION_ID) configured.push(`chrome-extension://${env.ALLOWED_EXTENSION_ID}`);
  return new Set(configured);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  if (!allowedOrigins(env).has(origin)) throw new HttpError(403, "ORIGIN_DENIED");
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

export function normalizeMimeType(value) {
  const mime = String(value || "text/plain").split(";", 1)[0].trim().toLowerCase();
  const aliases = { "text/x-markdown": "text/markdown", "application/csv": "text/csv" };
  return aliases[mime] || mime;
}

export function normalizeText(content, mimeType) {
  let text = String(content || "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "");
  if (mimeType === "text/html") {
    text = text
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(p|div|section|article|h[1-6]|li|tr)\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  } else if (mimeType === "text/csv") {
    text = text.split("\n").map((line) => line.trim()).join("\n");
  }
  return text.replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function splitParagraphs(text) {
  return text.split(/\n\s*\n/).flatMap((block) => {
    const trimmed = block.trim();
    if (!trimmed) return [];
    if (trimmed.length <= LIMITS.chunkChars) return [trimmed];
    const sentences = trimmed.match(/[^.!?\n]+(?:[.!?]+|$)/g) || [trimmed];
    const parts = [];
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > LIMITS.chunkChars) {
        parts.push(current.trim());
        current = "";
      }
      if (sentence.length > LIMITS.chunkChars) {
        for (let offset = 0; offset < sentence.length; offset += LIMITS.chunkChars) parts.push(sentence.slice(offset, offset + LIMITS.chunkChars).trim());
      } else current += sentence;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  });
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function chunkDocument(text, documentId, version = 1) {
  const paragraphs = splitParagraphs(text);
  const chunks = [];
  let current = "";
  let searchFrom = 0;
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (current && candidate.length > LIMITS.chunkChars) {
      chunks.push(current);
      const overlap = paragraph.length <= LIMITS.chunkChars - LIMITS.chunkOverlap - 2 ? current.slice(-LIMITS.chunkOverlap) : "";
      current = overlap ? `${overlap}\n\n${paragraph}` : paragraph;
    } else current = candidate;
  }
  if (current) chunks.push(current);

  const output = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const content = chunks[index];
    let start = text.indexOf(content, searchFrom);
    if (start < 0) start = Math.max(0, searchFrom - LIMITS.chunkOverlap);
    const end = Math.min(text.length, start + content.length);
    searchFrom = end;
    const id = `chk_${(await sha256(`${documentId}:${version}:${start}:${end}:${content}`)).slice(0, 32)}`;
    output.push({ id, index, content, charStart: start, charEnd: end, contentHash: await sha256(content) });
  }
  return output;
}

export function selectContext(items, maxChars = LIMITS.contextChars) {
  const selected = [];
  const seen = new Set();
  let used = 0;
  for (const item of items) {
    const key = `${item.document_id}:${item.content_hash}`;
    if (seen.has(key)) continue;
    const cost = item.content.length + 160;
    if (used + cost > maxChars) continue;
    seen.add(key);
    selected.push(item);
    used += cost;
  }
  return selected;
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
