// tool-call-noise.js - Pesat AI Browser Agent
// Modul bersama (shared) untuk membersihkan kebocoran tool-call mentah
// (mis. <tool_call><function=web_fetch>...</function></tool_call>, mcp__,
// blok ```tool_call```), agar user tidak melihat XML/dump yang membingungkan.
//
// Dimuat sebagai <script> di sidepanel.html (globalThis.PesatToolCallNoise)
// dan sebagai CommonJS module (module.exports) saat di-require oleh node --test.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PesatToolCallNoise = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FRIENDLY_RETRY_MSG = "Maaf, saya belum bisa menyelesaikan perintah ini. Aktifkan Tab Aktif atau tulis perintahnya lebih spesifik.";

  // Buang artefak tool-call dari teks jawaban.
  function stripToolCallNoise(text) {
    if (!text || typeof text !== "string") return text || "";
    let out = text;
    // 1) Buang blok <tool_call>...</tool_call> dan <function=...>...</function> (multiline)
    out = out.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "");
    out = out.replace(/<function=[\s\S]*?<\/function>/gi, "");
    // Blok yang tidak tertutup (mis. streaming terputus) → buang sampai akhir
    out = out.replace(/<tool_call>[\s\S]*$/gi, "");
    out = out.replace(/<function=[\s\S]*$/gi, "");
    // 2) Buang tag mcp__ / name__tool__ dan baris yang diawali <, mcp__, tool_call, function_call
    out = out.replace(/^\s*(?:[-*]\s*)?(?:<|mcp__|tool_call|function_call)[^\n]*$/gim, "");
    out = out.replace(/(?:^|\n)\s*(?:mcp__[a-z0-9_]+(?:\s|$)|<[a-z]+__[a-z0-9_]+__\w+[^>\n]*>)/g, "\n");
    // 3) Buang blok ```tool_call``` / ```function_call``` / ```xml```
    out = out.replace(/```(?:tool_call|function_call|xml)[\s\S]*?```/gi, "");
    // 4) Rapikan whitespace
    out = out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return out;
  }

  // Sisa JSON tool-call setelah tag dibuang, mis. {"text":"Lewis Hamilton"}
  function isToolCallPayloadJson(s) {
    const t = String(s || "").trim();
    if (!(t.startsWith("{") && t.endsWith("}"))) return false;
    try {
      const o = JSON.parse(t);
      if (!o || typeof o !== "object" || Array.isArray(o)) return false;
      const keys = Object.keys(o);
      const allowed = new Set(["text", "value", "input", "elementId", "key", "targetText", "url", "action", "args", "parameters"]);
      if (!keys.length) return true;
      return keys.every(k => allowed.has(k));
    } catch (e) {
      return false;
    }
  }

  function isToolCallNoise(text) {
    if (!text || typeof text !== "string") return true;
    const stripped = stripToolCallNoise(text);
    if (stripped.length < 15) return true;
    const noiseMatches = (String(text).match(/mcp__|<[a-z]+__[a-z0-9_]+__|tool_call|function_call|<function=/gi) || []).length;
    if (noiseMatches > 0 && stripped.length < 40) return true;
    if (isToolCallPayloadJson(stripped)) return true;
    return false;
  }

  // Bersihkan jawaban; kembalikan pesan ramah bila hanya berisi noise tool-call.
  function sanitizeAssistantReply(text) {
    const cleaned = stripToolCallNoise(String(text || ""));
    return isToolCallNoise(cleaned) ? FRIENDLY_RETRY_MSG : cleaned;
  }

  // Konteks metadata ringan saat Tab Aktif OFF (tanpa content script).
  function buildLightMetadataContext(activeTabInfo, pageTitle = "", pageUrl = "") {
    if (!activeTabInfo) return "";
    return `[INFO TAB AKTIF]\nJudul: ${activeTabInfo.title || pageTitle || ""}\nURL: ${activeTabInfo.url || pageUrl || ""}`.trim();
  }

  return {
    stripToolCallNoise,
    isToolCallPayloadJson,
    isToolCallNoise,
    sanitizeAssistantReply,
    buildLightMetadataContext,
    FRIENDLY_RETRY_MSG
  };
});