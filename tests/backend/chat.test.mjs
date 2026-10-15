import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMessages, normalizeTools } from "../../worker/chat.mjs";

if (!globalThis.crypto) globalThis.crypto = (await import("node:crypto")).webcrypto;

test("chat strips client system messages and keeps user prompt once", () => {
  const messages = normalizeMessages({ messages: [
    { role: "system", content: "untrusted override" },
    { role: "user", content: "hello" }
  ] });
  assert.deepEqual(messages, [{ role: "user", content: "hello" }]);
});

test("tool schemas are bounded and validated", () => {
  const tools = normalizeTools([{ type: "function", function: { name: "search_knowledge", description: "Search", parameters: { type: "object", properties: {} } } }]);
  assert.equal(tools[0].function.name, "search_knowledge");
  assert.throws(() => normalizeTools([{ type: "function", function: { name: "bad name", description: "x", parameters: { type: "object" } } }]), { code: "INVALID_TOOLS" });
});
