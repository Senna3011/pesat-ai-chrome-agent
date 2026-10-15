import test from "node:test";
import assert from "node:assert/strict";
import { LIMITS, allowedOrigins, chunkDocument, normalizeText, selectContext, sha256 } from "../../worker/helpers.mjs";

const originalCrypto = globalThis.crypto;
if (!originalCrypto) globalThis.crypto = (await import("node:crypto")).webcrypto;

test("normalizeText removes active HTML and preserves paragraph breaks", () => {
  const result = normalizeText("<h1>Title</h1><script>steal()</script><p>Hello&nbsp;world</p>", "text/html");
  assert.equal(result, "Title\n\nHello world");
  assert.doesNotMatch(result, /steal/);
});

test("chunkDocument is bounded and stable", async () => {
  const text = Array.from({ length: 20 }, (_, index) => `Paragraph ${index}. ${"word ".repeat(80)}`).join("\n\n");
  const first = await chunkDocument(text, "doc_1", 1);
  const second = await chunkDocument(text, "doc_1", 1);
  assert.ok(first.length > 1);
  assert.deepEqual(first, second);
  assert.ok(first.every((chunk) => chunk.content.length <= LIMITS.chunkChars));
  assert.equal(new Set(first.map((chunk) => chunk.id)).size, first.length);
});

test("document version changes stable chunk IDs", async () => {
  const [versionOne] = await chunkDocument("First paragraph.\n\nSecond paragraph.", "doc_1", 1);
  const [versionTwo] = await chunkDocument("First paragraph.\n\nSecond paragraph.", "doc_1", 2);
  assert.notEqual(versionOne.id, versionTwo.id);
});

test("selectContext deduplicates content and enforces budget", () => {
  const items = [
    { document_id: "a", content_hash: "x", content: "a".repeat(100) },
    { document_id: "a", content_hash: "x", content: "duplicate" },
    { document_id: "b", content_hash: "y", content: "b".repeat(100) }
  ];
  assert.equal(selectContext(items, 300).length, 1);
  assert.equal(selectContext(items, 600).length, 2);
});

test("allowedOrigins uses exact configured values", () => {
  const origins = allowedOrigins({ ALLOWED_ORIGINS: "https://app.example.com, http://localhost:3000", ALLOWED_EXTENSION_ID: "abc" });
  assert.equal(origins.has("https://app.example.com"), true);
  assert.equal(origins.has("https://app.example.com.evil.test"), false);
  assert.equal(origins.has("chrome-extension://abc"), true);
});

test("sha256 returns canonical digest", async () => {
  assert.equal(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
