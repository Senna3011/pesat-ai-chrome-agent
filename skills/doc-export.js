// skills/doc-export.js - Document & Export Engine Skill (skills.sh standard)
(() => {
  const DocExportSkill = {
    name: "doc-export",
    description: "Document & Export Engine Skill for formatting structured datasets into RFC 4180 CSV, formatted tables, and rich documents.",
    tools: [
      {
        type: "function",
        function: {
          name: "export_dataset_to_csv",
          description: "Format array or JSON dataset into RFC 4180 compliant CSV string and trigger browser file download.",
          parameters: {
            type: "object",
            properties: {
              filename: {
                type: "string",
                description: "Desired filename e.g. 'laporan_penjualan_2026.csv'"
              },
              columns: {
                type: "array",
                items: { type: "string" },
                description: "Array of column headers, e.g. ['No', 'Produk', 'Harga']"
              },
              rows: {
                type: "array",
                description: "2D Array of rows matching the columns."
              }
            },
            required: ["filename", "rows"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "format_rich_document",
          description: "Format text and tables into styled HTML document ready for export or pasting into Google Docs / MS Word.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              contentMarkdown: { type: "string" }
            },
            required: ["title", "contentMarkdown"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "export_dataset_to_excel",
          description: "Mengekspor tabel data atau hasil riset menjadi file spreadsheet Excel (.xls/.xlsx) yang siap dibuka.",
          parameters: {
            type: "object",
            properties: {
              filename: { type: "string", description: "Nama file tujuan, contoh: 'data_valuasi.xls'" },
              columns: { type: "array", items: { type: "string" }, description: "Header kolom" },
              rows: { type: "array", description: "Baris data 2D" }
            },
            required: ["filename", "rows"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "export_document_to_word",
          description: "Mengekspor artikel, riset, atau ringkasan menjadi file Word (.doc/.docx).",
          parameters: {
            type: "object",
            properties: {
              filename: { type: "string", description: "Nama file tujuan, contoh: 'laporan_riset.doc'" },
              title: { type: "string", description: "Judul dokumen" },
              contentMarkdown: { type: "string", description: "Isi teks dokumen" }
            },
            required: ["filename", "contentMarkdown"]
          }
        }
      }
    ],

    systemPromptRules: `
[SKILL: DOCUMENT & EXPORT ENGINE]
- Gunakan 'export_dataset_to_csv' saat pengguna meminta menyimpan, mengunduh, atau mengekspor data tabel/riset ke dalam file CSV.
- Gunakan 'export_dataset_to_excel' untuk mengunduh tabel langsung dalam format Excel (.xls/.xlsx).
- Gunakan 'export_document_to_word' untuk mengunduh draf artikel/dokumen ke format Word (.doc).
- Gunakan 'format_rich_document' untuk menyusun dokumen lengkap dengan format judul, subjudul, dan tabel bergaya korporat.
`,

    toCsvRFC4180(columns, rows) {
      function escapeCell(val) {
        if (val === null || val === undefined) return "";
        let str = String(val);
        if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }

      const allRows = [];
      if (columns && columns.length > 0) {
        allRows.push(columns.map(escapeCell).join(","));
      }
      rows.forEach((r) => {
        if (Array.isArray(r)) {
          allRows.push(r.map(escapeCell).join(","));
        } else if (typeof r === "object" && columns && columns.length > 0) {
          allRows.push(columns.map((c) => escapeCell(r[c])).join(","));
        }
      });
      return allRows.join("\r\n");
    },

    async execute(toolName, params, ctx = {}) {
      if (toolName === "export_dataset_to_csv") {
        const filename = (params.filename || `export-${Date.now()}.csv`).replace(/[^\w.-]/g, "_");
        const rows = Array.isArray(params.rows) ? params.rows : [];
        const columns = Array.isArray(params.columns) ? params.columns : [];

        const csvContent = this.toCsvRFC4180(columns, rows);

        // Download via background message
        const dlRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              action: "DOWNLOAD_FILE",
              params: {
                filename,
                content: csvContent,
                mimeType: "text/csv;charset=utf-8"
              }
            },
            resolve
          );
        });

        return {
          success: true,
          message: `File CSV '${filename}' berhasil dibuat (${rows.length} baris) dan diunduh.`,
          filename,
          downloadId: dlRes?.downloadId || null,
          rowsCount: rows.length
        };
      }

      if (toolName === "format_rich_document") {
        const title = params.title || "Dokumen";
        const content = params.contentMarkdown || "";

        return {
          success: true,
          title,
          formattedDocument: content,
          message: `Dokumen '${title}' berhasil diformat.`
        };
      }

      if (toolName === "export_dataset_to_excel") {
        const filename = (params.filename || `export-${Date.now()}.xls`).replace(/[^\w.-]/g, "_");
        const rows = Array.isArray(params.rows) ? params.rows : [];
        const columns = Array.isArray(params.columns) ? params.columns : [];

        let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
          `<head><meta charset="utf-8"></head><body><table border="1">`;
        if (columns.length > 0) {
          tableHtml += "<tr>" + columns.map(c => `<th style="background:#0f172a;color:#ffffff;font-weight:bold;">${c}</th>`).join("") + "</tr>";
        }
        rows.forEach(r => {
          const cells = Array.isArray(r) ? r : Object.values(r);
          tableHtml += "<tr>" + cells.map(c => `<td>${c !== null && c !== undefined ? c : ""}</td>`).join("") + "</tr>";
        });
        tableHtml += "</table></body></html>";

        const dlRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: "DOWNLOAD_FILE",
            params: {
              filename,
              content: tableHtml,
              mimeType: "application/vnd.ms-excel;charset=utf-8"
            }
          }, resolve);
        });

        return {
          success: true,
          message: `File Excel '${filename}' berhasil dibuat (${rows.length} baris) dan diunduh.`,
          filename,
          downloadId: dlRes?.downloadId || null,
          rowsCount: rows.length
        };
      }

      if (toolName === "export_document_to_word") {
        const filename = (params.filename || `dokumen-${Date.now()}.doc`).replace(/[^\w.-]/g, "_");
        const title = params.title || "Dokumen";
        const content = params.contentMarkdown || "";

        const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
          `<head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;line-height:1.6;padding:24px;}</style></head>` +
          `<body><h2>${title}</h2><div>${content.replace(/\n/g, "<br>")}</div></body></html>`;

        const dlRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: "DOWNLOAD_FILE",
            params: {
              filename,
              content: docHtml,
              mimeType: "application/msword;charset=utf-8"
            }
          }, resolve);
        });

        return {
          success: true,
          message: `File Dokumen '${filename}' berhasil dibuat dan diunduh.`,
          filename,
          downloadId: dlRes?.downloadId || null
        };
      }

      return { success: false, error: `Aksi doc-export tidak dikenal: ${toolName}` };
    }
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PesatDocExportSkill = DocExportSkill;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = DocExportSkill;
  }
})();
