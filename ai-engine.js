// ai-engine.js - Autonomous Agentic Workflow Assistant & Native Tool Calling Engine
(() => {
  const DEFAULT_CF_WORKER = "https://pesat-ai-chrome-agent.senna-947.workers.dev";
  const DEFAULT_PESATROUTER = "https://api.pesatrouter.com/v1";

  // Skema 6 Native Tools Resmi OpenAI
  const AGENTIC_TOOLS = [
    {
      type: "function",
      function: {
        name: "navigate_to",
        description: "Berpindah atau membuka URL baru pada tab peramban aktif",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL lengkap target (contoh: 'https://mail.google.com' atau 'https://google.com')" }
          },
          required: ["url"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "click_element",
        description: "Mengklik tombol atau elemen interaktif pada halaman web menggunakan hybrid selector (ID semantik [@e1], teks tombol, atau selector)",
        parameters: {
          type: "object",
          properties: {
            elementId: { type: "string", description: "ID semantik elemen seperti '@e1', '@e12' (disarankan)" },
            targetText: { type: "string", description: "Teks pada tombol (contoh: 'Tulis', 'Compose', 'Kirim', 'Submit')" },
            selector: { type: "string", description: "CSS selector alternatif (opsional)" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "type_text",
        description: "Mengisikan teks ke dalam elemen input, textarea, form pencarian, atau editor web",
        parameters: {
          type: "object",
          properties: {
            elementId: { type: "string", description: "ID semantik elemen seperti '@e2', '@e5'" },
            targetText: { type: "string", description: "Label atau placeholder kolom input (contoh: 'Kepada', 'Subjek', 'Search')" },
            text: { type: "string", description: "Teks yang akan diisikan" },
            pressEnter: { type: "boolean", description: "Set true jika perlu menekan tombol Enter setelah mengetik (misal kolom pencarian / tag email)" }
          },
          required: ["text"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "press_key",
        description: "Menekan tombol keyboard khusus seperti Enter, Tab, Escape, atau panah",
        parameters: {
          type: "object",
          properties: {
            key: { type: "string", description: "Nama tombol (contoh: 'Enter', 'Tab', 'Escape')" },
            elementId: { type: "string", description: "ID elemen target fokus (opsional)" }
          },
          required: ["key"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "ask_user",
        description: "Meminta konfirmasi atau klarifikasi kepada pengguna jika instruksi ambigu atau akan melakukan aksi penting/sensitif (misal: tombol 'Kirim Email', 'Delete', 'Checkout')",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string", description: "Pertanyaan atau konfirmasi untuk pengguna" },
            options: {
              type: "array",
              items: { type: "string" },
              description: "Pilihan jawaban cepat untuk pengguna (contoh: ['Ya, Kirim Sekarang', 'Batal'])"
            }
          },
          required: ["question"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "finish_task",
        description: "Menandai bahwa seluruh instruksi/tugas pengguna telah selesai dikerjakan secara tuntas di halaman web",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "Laporan atau ringkasan hasil kerja untuk pengguna" }
          },
          required: ["message"]
        }
      }
    }
  ];

  const SYSTEM_AGENTIC_PROMPT = `Kamu adalah Pesat AI Autonomous Crew Agent - Asisten peramban cerdas, teliti, dan mandiri untuk membantu produktivitas tim dan mempermudah pekerjaan manusia di browser.

PRINSIP & CARA KERJA UTAMA:
1. DUAL-INTENT CLASSIFIER:
   - MODE GENERATIF / INFORMASIONAL:
     Jika pengguna meminta penjelasan, analisis kode, jawaban pertanyaan (contoh: "ini platform apa?", "apa isi halaman ini?"), atau draf tulisan (artikel/email/sosmed), SELALU jawab langsung dengan teks Markdown yang rapi, ramah, dan terstruktur di obrolan Sidepanel. DILARANG memanggil finish_task atau tool lain jika pengguna hanya bertanya atau meminta draf!
   - MODE OTOMASI AGENTIC (AKSI FISIK):
     Jika pengguna meminta tindakan nyata di halaman web (contoh: "Buka gmail lalu kirim email ke...", "Isi form...", "Cari produk...", "Fix kode di editor web"):
     a. Tuliskan pemikiran/langkah singkat di chat.
     b. Panggil tool yang sesuai untuk eksekusi secara berurutan.
     c. Untuk tindakan sensitif (kirim email final, hapus data, checkout), gunakan tool \`ask_user\` sebelum menekan tombol eksekusi akhir bila diperlukan.

2. ATURAN EXECUTION & ANTI-LOOPING:
   - Evaluasi struktur elemen DOM setelah setiap aksi.
   - Pilihlah ID elemen semantik [@e1, @e2, dst] atau nama tombol nyata (targetText) yang terlihat pada snapshot halaman terkini.
   - Jika tujuan pengguna sudah tercapai di layar web, panggil tool \`finish_task\` dengan ringkasan hasil kerja.
   - Jika halaman saat ini adalah newtab atau kosong, gunakan \`navigate_to\` untuk membuka situs target.`;

  const PesatAIEngine = {
    getTools() {
      return AGENTIC_TOOLS;
    },

    async testConnection(cfg = {}) {
      const apiKey = (cfg.apiKey || "").trim();
      const model = (cfg.modelName || "").trim() || "pesat-flash";

      try {
        if (apiKey) {
          const baseUrl = (cfg.apiBaseUrl || "").trim() || DEFAULT_PESATROUTER;
          const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
          
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: "user", content: "ping" }],
              max_tokens: 5,
              temperature: 0.1
            })
          });

          if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`HTTP ${res.status}: ${errBody.substring(0, 180)}`);
          }

          return {
            success: true,
            model: model,
            message: "Koneksi PesatRouter aktif & terverifikasi"
          };
        } else {
          const res = await fetch(`${DEFAULT_CF_WORKER}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: "ping",
              phase: "plan",
              model: "pesat-flash"
            })
          });

          if (!res.ok && res.status !== 200) {
            throw new Error(`Cloudflare status ${res.status}`);
          }

          return {
            success: true,
            model: "pesat-flash (Free Tier / Cloudflare)",
            message: "Koneksi Cloudflare Worker siap digunakan"
          };
        }
      } catch (err) {
        return {
          success: false,
          error: err.message || "Gagal menghubungi server endpoint"
        };
      }
    },

    async callLLMDirect({ phase, prompt, messages = [], taskState = null, domTree = "", config = {}, signal, useTools = true }) {
      const promptText = prompt || "";
      const apiKey = (config.apiKey || "").trim();
      const model = (config.modelName || "").trim() || "pesat-flash";

      const domContext = domTree ? `\n\n[STRUKTUR ELEMEN HALAMAN SAAT INI]:\n${domTree}` : "";
      const fullSystemPrompt = SYSTEM_AGENTIC_PROMPT + domContext;

      const payloadMessages = [
        { role: "system", content: fullSystemPrompt },
        ...messages.filter(m => m.role !== "system").slice(-8)
      ];

      if (promptText && (!payloadMessages.length || payloadMessages[payloadMessages.length - 1].content !== promptText)) {
        payloadMessages.push({ role: "user", content: promptText });
      }

      if (apiKey) {
        const baseUrl = (config.apiBaseUrl || "").trim() || DEFAULT_PESATROUTER;
        const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

        const requestBody = {
          model: model,
          messages: payloadMessages,
          temperature: phase === "chat" ? 0.3 : 0.1
        };

        if (useTools && phase !== "chat") {
          requestBody.tools = AGENTIC_TOOLS;
          requestBody.tool_choice = "auto";
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: signal
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`API PesatRouter [${res.status}]: ${errText.substring(0, 200)}`);
        }

        const data = await res.json();
        const choice = data?.choices?.[0] || {};
        return {
          message: choice.message || { role: "assistant", content: "" },
          reply: choice.message?.content || "",
          tool_calls: choice.message?.tool_calls || null,
          usage: data.usage || null
        };
      } else {
        // Fallback Cloudflare Worker
        const workerEndpoint = `${DEFAULT_CF_WORKER}/api/chat`;
        const res = await fetch(workerEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: payloadMessages,
            prompt: promptText,
            phase: phase,
            model: model,
            domTree: domTree
          }),
          signal: signal
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Server Worker [${res.status}]: ${errText.substring(0, 200)}`);
        }

        const data = await res.json();
        const choice = data?.choices?.[0] || {};
        return {
          message: choice.message || { role: "assistant", content: data.reply || data.response || "" },
          reply: choice.message?.content || data.reply || data.response || "",
          tool_calls: choice.message?.tool_calls || null,
          usage: data.usage || null
        };
      }
    }
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PesatAIEngine = PesatAIEngine;
    globalThis.PesatAiEngine = PesatAIEngine;
  }
})();
