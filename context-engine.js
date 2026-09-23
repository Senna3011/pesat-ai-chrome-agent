// context-engine.js - Context Engine & Multi-Tab Reference Orchestrator
(() => {
  const PesatContextEngine = {
    async getFilteredGrouped(query = "") {
      const q = (query || "").toLowerCase().trim();
      const tabsResult = [];
      const connectorsResult = [
        { id: "active-tab", title: "Tab Aktif Saat Ini", icon: "🌐", type: "active_tab", subtitle: "Konteks halaman yang sedang Anda lihat" },
        { id: "google-workspace", title: "Google Docs / Sheets", icon: "📊", type: "workspace", subtitle: "Otomasi dokumen & spreadsheet Google" },
        { id: "email-client", title: "Email (Gmail / Webmail)", icon: "✉️", type: "email", subtitle: "Bantu draft & kirim email" },
        { id: "social-media", title: "Sosial Media (Twitter/LinkedIn)", icon: "📱", type: "social", subtitle: "Bantu buat & jadwalkan postingan" },
        { id: "code-editor", title: "Editor Kode (GitHub / Live Web)", icon: "💻", type: "code", subtitle: "Bantu analisa & fix coding di browser" }
      ];

      try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
          const allTabs = await chrome.tabs.query({ currentWindow: true });
          for (const tab of allTabs) {
            if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) continue;
            const title = tab.title || "Tab";
            const url = tab.url;
            if (!q || title.toLowerCase().includes(q) || url.toLowerCase().includes(q)) {
              tabsResult.push({
                id: `tab-${tab.id}`,
                tabId: tab.id,
                title: title,
                url: url,
                icon: tab.favIconUrl || "🌐",
                type: "tab",
                subtitle: url.length > 45 ? url.substring(0, 42) + "..." : url
              });
            }
          }
        }
      } catch (err) {
        console.warn("[ContextEngine] Tab query failed:", err);
      }

      const filteredConnectors = connectorsResult.filter(c =>
        !q || c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)
      );

      return {
        connectors: filteredConnectors,
        tabs: tabsResult
      };
    },

    createContextSource({ id, type, title, url, content, metadata = {} }) {
      return {
        id: id || `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: type || "custom",
        title: title || "Konteks",
        url: url || "",
        content: content || "",
        metadata: metadata,
        addedAt: new Date().toISOString()
      };
    },

    formatStructuredContextPrompt(sources = []) {
      if (!Array.isArray(sources) || sources.length === 0) return "";
      
      let prompt = "\n\n=== LAMPIRAN KONTEKS TAMBAHAN PENGGUNA ===\n";
      sources.forEach((src, idx) => {
        prompt += `\n[Konteks #${idx + 1}: ${src.title || src.type}]`;
        if (src.url) prompt += ` (URL: ${src.url})`;
        if (src.metadata && src.metadata.fileName) prompt += ` (File: ${src.metadata.fileName})`;
        prompt += "\n```\n";
        const contentStr = typeof src.content === "string" ? src.content : JSON.stringify(src.content, null, 2);
        prompt += contentStr.length > 8000 ? contentStr.substring(0, 8000) + "\n...[dipotong karena panjang]" : contentStr;
        prompt += "\n```\n";
      });
      prompt += "=== AKHIR LAMPIRAN KONTEKS ===\n";
      return prompt;
    }
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PesatContextEngine = PesatContextEngine;
  }
})();
