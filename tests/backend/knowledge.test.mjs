import test from "node:test";
import assert from "node:assert/strict";
import { buildKnowledgeFilter, normalizeSourceTypes } from "../../worker/knowledge.mjs";

if (!globalThis.crypto) globalThis.crypto = (await import("node:crypto")).webcrypto;

test("knowledge filter always scopes tenant", () => {
  assert.deepEqual(buildKnowledgeFilter("tenant-1"), { tenant_id: { $eq: "tenant-1" } });
  assert.deepEqual(buildKnowledgeFilter("tenant-1", ["page", "upload"]), {
    $and: [
      { tenant_id: { $eq: "tenant-1" } },
      { source_type: { $in: ["page", "upload"] } }
    ]
  });
});

test("source type validation rejects unsupported filters", () => {
  assert.deepEqual(normalizeSourceTypes(["page", "page", "text"]), ["page", "text"]);
  assert.throws(() => normalizeSourceTypes(["private"]), { code: "INVALID_SOURCE_TYPE" });
});
