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
      },
      {
        type: "function",
        function: {
          name: "check_serp_ranking",
          description: "Periksa peringkat/posisi website pada hasil pencarian Google (SERP) melintasi beberapa halaman secara otonom.",
          parameters: {
            type: "object",
            properties: {
              keyword: {
                type: "string",
                description: "Kata kunci (keyword) pencarian di Google."
              },
              targetDomain: {
                type: "string",
                description: "Nama domain atau website target yang ingin dicek posisinya (contoh: filterairgadingserpong.com)."
              },
              maxPages: {
                type: "number",
                description: "Batas maksimal halaman yang dipindai (default: 5, max: 10)."
              }
            },
            required: ["keyword", "targetDomain"]
          }
        }
      }
    ],

    systemPromptRules: `
[SKILL: DEEP TABLE & MULTI-PAGE SCRAPER]
- Gunakan 'extract_table_data' saat pengguna meminta mengekstrak tabel, perbandingan harga, atau daftar item dari halaman aktif.
- Gunakan 'scrape_multipage_table' saat pengguna meminta data komparasi multi-halaman atau katalog produk lintas halaman.
- Gunakan 'check_serp_ranking' saat pengguna meminta mengecek posisi/ranking sebuah website di Google SERP untuk keyword tertentu.
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

      if (toolName === "check_serp_ranking") {
        const keyword = String(params.keyword || "").trim();
        const targetDomain = String(params.targetDomain || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").trim().toLowerCase();
        const maxPages = Math.min(Math.max(Number(params.maxPages) || 5, 1), 10);

        if (!keyword || !targetDomain) {
          return { success: false, error: "Keyword dan targetDomain wajib diisi." };
        }

        let foundResult = null;
        let totalChecked = 0;

        for (let page = 1; page <= maxPages; page++) {
          ctx.showStatusIndicator?.(`Mengecek SERP Halaman ${page}/${maxPages}...`);
          const startOffset = (page - 1) * 10;
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}${startOffset > 0 ? `&start=${startOffset}` : ""}`;

          await ctx.sendToBackground?.({ action: "NAVIGATE_TAB", url: searchUrl });
          await new Promise(r => setTimeout(r, 1800));
          await ctx.sendToContentScript?.({ type: "WAIT_FOR_DOM_STABLE", maxWaitMs: 3000, stableWindowMs: 500 });

          const serpData = await ctx.sendToContentScript?.({ type: "EXTRACT_SERP_DATA" });
          const items = Array.isArray(serpData?.items) ? serpData.items : [];
          totalChecked += items.length;

          for (const item of items) {
            const itemDomain = (item.domain || "").toLowerCase();
            const normTarget = targetDomain.toLowerCase();
            const isMatch = itemDomain === normTarget ||
                            itemDomain.endsWith("." + normTarget) ||
                            normTarget.endsWith("." + itemDomain) ||
                            itemDomain.includes(normTarget) ||
                            normTarget.includes(itemDomain) ||
                            (item.url || "").toLowerCase().includes(normTarget);

            if (isMatch) {
              foundResult = {
                item,
                page,
                positionOnPage: item.rankOnPage,
                absoluteRank: startOffset + item.rankOnPage
              };
              break;
            }
          }

          if (foundResult) break;
        }

        if (foundResult) {
          return {
            success: true,
            found: true,
            targetDomain,
            keyword,
            rank: foundResult.absoluteRank,
            page: foundResult.page,
            positionOnPage: foundResult.positionOnPage,
            title: foundResult.item.title,
            url: foundResult.item.url,
            message: `Website '${targetDomain}' ditemukan di Halaman ${foundResult.page}, Peringkat #${foundResult.absoluteRank} Google untuk keyword '${keyword}'.`
          };
        }

        return {
          success: true,
          found: false,
          targetDomain,
          keyword,
          pagesScanned: maxPages,
          totalChecked,
          message: `Website '${targetDomain}' tidak ditemukan di ${maxPages} halaman pertama Google untuk keyword '${keyword}'.`
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
