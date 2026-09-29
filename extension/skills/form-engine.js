// skills/form-engine.js - Smart Form Inspection & Auto-Fill Skill (skills.sh standard)
(() => {
  const FormEngineSkill = {
    name: "form-engine",
    description: "Smart Form Inspection & Auto-Fill Skill with support for native React/Vue synthetic event value setters.",
    tools: [
      {
        type: "function",
        function: {
          name: "inspect_form_fields",
          description: "Inspect active page to discover all inputs, textareas, selects, and checkboxes with their labels and placeholders.",
          parameters: {
            type: "object",
            properties: {
              formSelector: {
                type: "string",
                description: "Optional CSS selector of the specific form container."
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "autofill_form_batch",
          description: "Fill multiple form fields in one batched execution with framework-compatible change triggers (React/Vue/Angular).",
          parameters: {
            type: "object",
            properties: {
              fields: {
                type: "array",
                description: "Array of field values to fill: [{ identifier: 'name|id|label', value: '...' }]",
                items: {
                  type: "object",
                  properties: {
                    identifier: { type: "string" },
                    value: { type: "string" }
                  },
                  required: ["identifier", "value"]
                }
              },
              submitAfter: {
                type: "boolean",
                description: "Whether to submit the form after filling (default: false)."
              }
            },
            required: ["fields"]
          }
        }
      }
    ],

    systemPromptRules: `
[SKILL: SMART FORM INSPECTION & AUTO-FILL]
- Gunakan 'inspect_form_fields' saat pengguna meminta mengisi formulir pendaftaran, checkout, survey, atau kontak untuk mengetahui daftar input yang tersedia.
- Gunakan 'autofill_form_batch' untuk mengisi seluruh field dalam satu langkah efisien, daripada memanggil aksi 'type' berkali-kali.
`,

    async execute(toolName, params, ctx = {}) {
      if (toolName === "inspect_form_fields") {
        const inspectRes = await ctx.sendToContentScript?.({
          type: "EXECUTE_ACTION",
          actionData: {
            action: "inspect_form_fields",
            formSelector: params.formSelector || null
          }
        });

        if (!inspectRes || !inspectRes.success) {
          return {
            success: false,
            error: inspectRes?.error || "Gagal menginspeksi formulir pada halaman aktif."
          };
        }

        return {
          success: true,
          message: `Ditemukan ${inspectRes.fields?.length || 0} elemen formulir.`,
          fields: inspectRes.fields || [],
          stateChanged: false
        };
      }

      if (toolName === "autofill_form_batch") {
        const fields = Array.isArray(params.fields) ? params.fields : [];
        if (fields.length === 0) {
          return { success: false, error: "Daftar fields kosong." };
        }

        const fillRes = await ctx.sendToContentScript?.({
          type: "EXECUTE_ACTION",
          actionData: {
            action: "autofill_form_batch",
            fields: fields,
            submitAfter: Boolean(params.submitAfter)
          }
        });

        if (!fillRes || !fillRes.success) {
          return {
            success: false,
            error: fillRes?.error || "Gagal mengisi field formulir."
          };
        }

        return {
          success: true,
          message: `Berhasil mengisi ${fillRes.filledCount || fields.length} elemen formulir.`,
          filledCount: fillRes.filledCount || fields.length,
          stateChanged: true
        };
      }

      return { success: false, error: `Aksi form-engine tidak dikenal: ${toolName}` };
    }
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PesatFormEngineSkill = FormEngineSkill;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = FormEngineSkill;
  }
})();
