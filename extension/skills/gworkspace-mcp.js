// skills/gworkspace-mcp.js - Google Workspace REST/MCP Skill (skills.sh standard)
(() => {
  const GWorkspaceMCPSkill = {
    name: "gworkspace-mcp",
    description: "Google Workspace REST/MCP Client Skill for direct background operations on Google Sheets (v4) and Google Docs (v1).",
    tools: [
      {
        type: "function",
        function: {
          name: "gworkspace_append_sheet_data",
          description: "Append rows of data directly into a Google Spreadsheet using Google Sheets REST API v4 (bypasses canvas DOM).",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the Google Spreadsheet (extracted from URL e.g. /d/{spreadsheetId}/edit)."
              },
              range: {
                type: "string",
                description: "Sheet range to append, e.g. 'Sheet1!A1' or 'Sheet1!A:E'."
              },
              rows: {
                type: "array",
                description: "2D Array of rows to append, e.g. [['No', 'Produk', 'Harga'], [1, 'Laptop', 10000000]]",
                items: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            },
            required: ["spreadsheetId", "rows"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "gworkspace_read_sheet",
          description: "Read values from a Google Spreadsheet range using Google Sheets REST API v4.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the Google Spreadsheet."
              },
              range: {
                type: "string",
                description: "Sheet range to read, e.g. 'Sheet1!A1:E20'."
              }
            },
            required: ["spreadsheetId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "gworkspace_write_doc",
          description: "Insert paragraphs or structured text into a Google Document using Google Docs REST API v1.",
          parameters: {
            type: "object",
            properties: {
              documentId: {
                type: "string",
                description: "The ID of the Google Document (extracted from URL e.g. /d/{documentId}/edit)."
              },
              text: {
                type: "string",
                description: "Text content to insert at the end of the document."
              }
            },
            required: ["documentId", "text"]
          }
        }
      }
    ],

    systemPromptRules: `
[SKILL: GOOGLE WORKSPACE REST/MCP]
- Gunakan 'gworkspace_append_sheet_data' atau 'gworkspace_read_sheet' ketika pengguna meminta operasi Google Sheets dan akun Google Workspace sudah terhubung via OAuth token.
- Gunakan 'gworkspace_write_doc' untuk menyisipkan teks atau artikel langsung ke dokumen Google Docs via REST API latar belakang.
`,

    async getAuthToken() {
      return new Promise((resolve) => {
        chrome.storage.local.get(["googleAuthToken"], (res) => {
          resolve(res.googleAuthToken || null);
        });
      });
    },

    async execute(toolName, params, ctx = {}) {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: "AUTH_REQUIRED: Akun Google Workspace belum terhubung. Silakan login pada menu 'Pengaturan Google' di Sidepanel atau gunakan fallback pengetikan browser.",
          requiresAuth: true
        };
      }

      if (toolName === "gworkspace_append_sheet_data") {
        const spreadsheetId = params.spreadsheetId;
        const range = params.range || "Sheet1!A1";
        const rows = Array.isArray(params.rows) ? params.rows : [];

        if (!spreadsheetId || rows.length === 0) {
          return { success: false, error: "spreadsheetId dan rows tidak boleh kosong." };
        }

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: rows })
        });

        if (!res.ok) {
          const errText = await res.text();
          return { success: false, error: `Google Sheets API Error (${res.status}): ${errText}` };
        }

        const data = await res.json();
        return {
          success: true,
          message: `Berhasil menambahkan ${rows.length} baris data ke Google Spreadsheet via REST API.`,
          updatedRange: data.updates?.updatedRange || range,
          updatedRows: data.updates?.updatedRows || rows.length,
          stateChanged: true
        };
      }

      if (toolName === "gworkspace_read_sheet") {
        const spreadsheetId = params.spreadsheetId;
        const range = params.range || "Sheet1!A1:Z100";

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;

        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          const errText = await res.text();
          return { success: false, error: `Google Sheets API Error (${res.status}): ${errText}` };
        }

        const data = await res.json();
        return {
          success: true,
          values: data.values || [],
          message: `Berhasil membaca ${(data.values || []).length} baris dari Google Spreadsheet.`
        };
      }

      if (toolName === "gworkspace_write_doc") {
        const documentId = params.documentId;
        const textToInsert = params.text || "";

        const url = `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`;

        const requests = [
          {
            insertText: {
              endOfSegmentLocation: { segmentId: "" },
              text: `\n${textToInsert}\n`
            }
          }
        ];

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ requests })
        });

        if (!res.ok) {
          const errText = await res.text();
          return { success: false, error: `Google Docs API Error (${res.status}): ${errText}` };
        }

        return {
          success: true,
          message: `Berhasil menuliskan ${textToInsert.length} karakter ke Google Document via REST API.`,
          stateChanged: true
        };
      }

      return { success: false, error: `Aksi gworkspace-mcp tidak dikenal: ${toolName}` };
    }
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PesatGWorkspaceMCPSkill = GWorkspaceMCPSkill;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = GWorkspaceMCPSkill;
  }
})();
