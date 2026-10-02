// context-engine.js - Context Engine & Multi-Tab Reference Orchestrator
(() => {
  const PesatContextEngine = {
    async getFilteredGrouped(query = "") {
      const q = (query || "").toLowerCase().trim();
      const tabsResult = [];
      const connectorsResult = [
        { id: "active-tab", name: "tab-aktif", title: "Tab Aktif Saat Ini", icon: "🌐", type: "Connector", subtitle: "Konteks halaman yang sedang Anda lihat", metadata: { title: "Tab Aktif", icon: "🌐", description: "Halaman web yang sedang dibuka" } },
        { id: "google-workspace", name: "google-workspace", title: "Google Docs / Sheets", icon: "📊", type: "Connector", subtitle: "Otomasi dokumen & spreadsheet Google", metadata: { title: "Google Workspace", icon: "📊", description: "Otomasi dokumen & spreadsheet" } },
        { id: "email-client", name: "gmail", title: "Email (Gmail / Webmail)", icon: "✉️", type: "Connector", subtitle: "Bantu draft & kirim email", metadata: { title: "Email", icon: "✉️", description: "Draf & kirim pesan" } },
        { id: "social-media", name: "sosmed", title: "Sosial Media (Twitter/LinkedIn)", icon: "📱", type: "Connector", subtitle: "Bantu buat & jadwalkan postingan", metadata: { title: "Sosial Media", icon: "📱", description: "Postingan media sosial" } },
        { id: "code-editor", name: "code-editor", title: "Editor Kode (GitHub / Live Web)", icon: "💻", type: "Connector", subtitle: "Bantu analisa & fix coding di browser", metadata: { title: "Editor Kode", icon: "💻", description: "Analisis & fix coding" } }
      ];

      try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
          const allTabs = await chrome.tabs.query({ currentWindow: true });
          allTabs.forEach((tab, idx) => {
            if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) return;
            const title = tab.title || "Tab";
            const url = tab.url;
            const tabName = `tab${idx + 1}`;
            let domain = "";
            try { domain = new URL(url).hostname; } catch (_) {}

            if (!q || tabName.includes(q) || title.toLowerCase().includes(q) || url.toLowerCase().includes(q) || domain.toLowerCase().includes(q)) {
              tabsResult.push({
                id: `tab-${tab.id}`,
                tabId: tab.id,
                name: tabName,
                title: `[@${tabName}] ${title}`,
                url: url,
                icon: tab.favIconUrl || "🌐",
                type: "BrowserTab",
                subtitle: domain ? `${domain} — ${title}` : (url.length > 45 ? url.substring(0, 42) + "..." : url),
                metadata: {
                  tabId: tab.id,
                  title: title,
                  url: url,
                  domain: domain,
                  active: !!tab.active,
                  favIconUrl: tab.favIconUrl,
                  index: idx + 1
                }
              });
            }
          });
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
        prompt += `\n[Konteks #${idx + 1}: ${src.title || src.name || src.type}]`;
        if (src.url) prompt += ` (URL: ${src.url})`;
        if (src.metadata && src.metadata.fileName) prompt += ` (File: ${src.metadata.fileName})`;
        prompt += "\n```\n";
        const rawContent = src.content ?? src.metadata?.extractedText ?? src.metadata?.content ?? src.dataUrl ?? "";
        const contentStr = typeof rawContent === "string" ? rawContent : (JSON.stringify(rawContent, null, 2) || "");
        prompt += (contentStr && contentStr.length > 8000) ? contentStr.substring(0, 8000) + "\n...[dipotong karena panjang]" : (contentStr || "(Konten kosong)");
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
