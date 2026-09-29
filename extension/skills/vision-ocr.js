// skills/vision-ocr.js - Vision & Canvas OCR Skill (skills.sh standard)
(() => {
  const VisionOCRSkill = {
    name: "vision-ocr",
    description: "Vision & Canvas OCR Skill for reading non-DOM canvas like Google Docs/PDF and finding text coordinates.",
    tools: [
      {
        type: "function",
        function: {
          name: "ocr_inspect_canvas",
          description: "Capture visible screenshot and perform OCR analysis on canvas elements (e.g. Google Docs Kix, PDF viewer, charts) to extract text and bounding boxes.",
          parameters: {
            type: "object",
            properties: {
              targetArea: {
                type: "string",
                enum: ["canvas_only", "full_viewport"],
                description: "Target area to analyze (default: canvas_only)"
              },
              prompt: {
                type: "string",
                description: "Specific question or text query to look for on the canvas."
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "click_canvas_text",
          description: "Locate specific text on canvas using OCR coordinates and perform simulated mouse click at (x, y).",
          parameters: {
            type: "object",
            properties: {
              targetText: {
                type: "string",
                description: "Text label or word on the canvas to click."
              }
            },
            required: ["targetText"]
          }
        }
      }
    ],

    systemPromptRules: `
[SKILL: VISION & CANVAS OCR]
- Gunakan 'ocr_inspect_canvas' ketika halaman web menggunakan elemen <canvas> (seperti Google Docs .kix-appview-editor, PDF Viewer, WebGL, TradingView chart) di mana teks tidak tersedia di DOM biasa.
- Gunakan 'click_canvas_text' untuk mengklik tombol atau teks yang tertera di dalam canvas berdasarkan koordinat visual.
`,

    async execute(toolName, params, ctx = {}) {
      if (toolName === "ocr_inspect_canvas") {
        // 1. Capture visible tab
        const screenshotRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "SCREENSHOT" }, resolve);
        });

        if (!screenshotRes || !screenshotRes.success || !screenshotRes.dataUrl) {
          return { success: false, error: "Gagal mengambil tangkapan layar untuk Vision OCR." };
        }

        // 2. Query canvas element bounding boxes from content script
        let canvasBbox = null;
        try {
          const domRes = await ctx.sendToContentScript?.({
            type: "GET_CANVAS_RECTS"
          });
          canvasBbox = domRes?.rects || null;
        } catch (_) {}

        return {
          success: true,
          message: "Tangkapan layar canvas berhasil diperoleh.",
          screenshotDataUrl: screenshotRes.dataUrl,
          canvasRects: canvasBbox,
          hasVisionContext: true
        };
      }

      if (toolName === "click_canvas_text") {
        const targetText = String(params.targetText || "").trim();
        if (!targetText) {
          return { success: false, error: "targetText wajib diisi." };
        }

        // Delegasikan ke content script click_coords jika koordinat ditemukan
        const clickRes = await ctx.sendToContentScript?.({
          type: "EXECUTE_ACTION",
          actionData: {
            action: "click_canvas_text",
            text: targetText
          }
        });

        return clickRes || { success: true, message: `Mencoba mengklik teks '${targetText}' pada canvas.` };
      }

      return { success: false, error: `Aksi vision-ocr tidak dikenal: ${toolName}` };
    }
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PesatVisionOCRSkill = VisionOCRSkill;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = VisionOCRSkill;
  }
})();
