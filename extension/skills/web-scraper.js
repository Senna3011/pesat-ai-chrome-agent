// skills/web-scraper.js - Deep Table & Multi-Page Data Extraction Skill (skills.sh standard)
(() => {
  const WebScraperSkill = {
    name: "web-scraper",
    description: "Deep Table & Multi-Page Data Extraction Skill for structured tables, card grids, and automatic pagination detection.",
    tools: [
      {
        type: "function",
        function: {
          name: "extract_table_data",
          description: "Extract structured tabular data (columns & rows) from tables, grids, or repeated card lists on the active page.",
          parameters: {
            type: "object",
            properties: {
              selector: {
                type: "string",
                description: "Optional CSS selector of target table or container (default: auto-detect best table)."
              },
              maxRows: {
                type: "number",
                description: "Maximum number of rows to extract (default: 50)."
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "scrape_multipage_table",
          description: "Scrape tabular data across multiple pages automatically following 'Next' / pagination buttons.",
          parameters: {
            type: "object",
            properties: {
              maxPages: {
                type: "number",
                description: "Maximum number of pages to navigate and scrape (default: 3, max: 10)."
              },
              targetKeyword: {
                type: "string",
                description: "Optional filter keyword for rows."
              }
            }
          }
        }
      }
    ],

    systemPromptRules: `
[SKILL: DEEP TABLE & MULTI-PAGE SCRAPER]
- Gunakan 'extract_table_data' saat pengguna meminta mengekstrak tabel, perbandingan harga, atau daftar item dari halaman aktif.
- Gunakan 'scrape_multipage_table' saat pengguna meminta data komparasi multi-halaman atau katalog produk lintas halaman.
`,

    async execute(toolName, params, ctx = {}) {
      if (toolName === "extract_table_data") {
        const scrapeRes = await ctx.sendToContentScript?.({
          type: "EXECUTE_ACTION",
          actionData: {
            action: "extract_table_data",
            selector: params.selector || null,
            maxRows: params.maxRows || 50
          }
        });

        if (!scrapeRes || !scrapeRes.success) {
          return {
            success: false,
            error: scrapeRes?.error || "Gagal mengekstrak data tabel dari halaman aktif."
          };
        }

        return {
          success: true,
          message: `Berhasil mengekstrak ${scrapeRes.rows?.length || 0} baris data tabel.`,
          columns: scrapeRes.columns || [],
          rows: scrapeRes.rows || [],
          stateChanged: false
        };
      }

      if (toolName === "scrape_multipage_table") {
        const maxPages = Math.min(Math.max(Number(params.maxPages) || 3, 1), 10);
        let aggregatedRows = [];
        let columns = [];
        let pagesScraped = 0;

        for (let p = 1; p <= maxPages; p++) {
          ctx.showStatusIndicator?.(`Mengekstrak data halaman ${p}/${maxPages}...`);

          const pageRes = await ctx.sendToContentScript?.({
            type: "EXECUTE_ACTION",
            actionData: { action: "extract_table_data", maxRows: 50 }
          });

          if (pageRes && pageRes.success && Array.isArray(pageRes.rows)) {
            if (columns.length === 0 && pageRes.columns) columns = pageRes.columns;
            aggregatedRows.push(...pageRes.rows);
            pagesScraped++;
          }

          if (p >= maxPages) break;

          // Coba navigasi ke halaman berikutnya via click_next_page
          const nextRes = await ctx.sendToContentScript?.({
            type: "EXECUTE_ACTION",
            actionData: { action: "click_next_page" }
          });

          if (!nextRes || !nextRes.success) {
            ctx.appendLog?.(`Tombol halaman berikutnya tidak ditemukan. Berhenti di halaman ${p}.`, "INFO");
            break;
          }

          await new Promise((r) => setTimeout(r, 1500));
          await ctx.sendToContentScript?.({
            type: "WAIT_FOR_DOM_STABLE",
            maxWaitMs: 3000,
            stableWindowMs: 500
          });
        }

        return {
          success: aggregatedRows.length > 0,
          message: `Berhasil mengekstrak ${aggregatedRows.length} baris data dari ${pagesScraped} halaman.`,
          columns,
          rows: aggregatedRows,
          pagesScraped,
          stateChanged: pagesScraped > 1
        };
      }

      return { success: false, error: `Aksi web-scraper tidak dikenal: ${toolName}` };
    }
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PesatWebScraperSkill = WebScraperSkill;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = WebScraperSkill;
  }
})();
