// skills/web-search.js - Live Web Search Skill (no API key)
// Mencari info terkini via DuckDuckGo HTML (utama) / Bing (fallback) dengan
// menavigasi tab lalu mengekstrak hasil (judul, URL bersih, cuplikan).
(() => {
  const clean = (url) => {
    try {
      return globalThis.PesatSourceResolver?.cleanUrl?.(url) || String(url || "");
    } catch (_) {
      return String(url || "");
    }
  };

  const WebSearchSkill = {
    name: "web-search",
    description: "Live web search for up-to-date information (news, prices, official data) without an API key. Returns clean result links.",
    tools: [
      {
        type: "function",
        function: {
          name: "web_search",
          description: "Search the live web for current information and return a list of results (title, clean URL, snippet). Use for real-time/terkini queries.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", minLength: 2, maxLength: 400, description: "Search query / topic." },
              maxResults: { type: "number", minimum: 1, maximum: 10, description: "Maximum results to return (default 6)." }
            },
            required: ["query"],
            additionalProperties: false
          }
        }
      }
    ],

    getSystemPromptAdditions() {
      return "\n- Gunakan tool `web_search` bila pengguna meminta informasi terkini/real-time (berita hari ini, harga/kurs terbaru, data resmi terupdate). Sajikan bagian **Sources** dengan link bersih yang bisa diklik. Jangan mengarang bila data tidak diperoleh.";
    },

    async execute(toolName, params, ctx = {}) {
      if (toolName !== "web_search") {
        return { success: false, error: `Unknown web-search tool: ${toolName}` };
      }

      const query = String(params?.query || "").trim();
      const maxResults = Math.min(Math.max(Number(params?.maxResults) || 6, 1), 10);
      if (query.length < 2) {
        return { success: false, error: "Query too short." };
      }

      const runEngine = async (engine) => {
        const url = engine === "bing"
          ? `https://www.bing.com/search?q=${encodeURIComponent(query)}`
          : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        ctx.showStatusIndicator?.(`Searching the web (${engine})...`);
        await ctx.sendToBackground?.({ action: "NAVIGATE_TAB", url });
        await new Promise(r => setTimeout(r, 1600));
        await ctx.sendToContentScript?.({ type: "WAIT_FOR_DOM_STABLE", maxWaitMs: 3000, stableWindowMs: 500 }).catch?.(() => {});
        const res = await ctx.sendToContentScript?.({ type: "EXTRACT_WEB_RESULTS", maxResults });
        const items = Array.isArray(res?.results) ? res.results : [];
        return items
          .map(it => ({ title: String(it.title || "").trim(), url: clean(it.url), snippet: String(it.snippet || "").trim() }))
          .filter(it => it.title && /^https?:\/\//i.test(it.url))
          .slice(0, maxResults);
      };

      let results = [];
      let engine = "duckduckgo";
      try {
        results = await runEngine("duckduckgo");
        if (!results.length) { engine = "bing"; results = await runEngine("bing"); }
      } catch (err) {
        return { success: false, error: `Web search failed: ${err.message}` };
      }

      if (!results.length) {
        return { success: false, error: `No results for "${query}".`, results: [], engine };
      }

      return {
        success: true,
        engine,
        query,
        results,
        message: `Found ${results.length} result(s) for "${query}".`
      };
    }
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PesatWebSearchSkill = WebSearchSkill;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = WebSearchSkill;
  }
})();