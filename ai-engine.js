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

PRINSIP & PROTOKOL INTERAKSI UTAMA:

1. PROTOKOL RELIABILITAS INTERAKSI WEB (Web Interaction Reliability Protocol):
   - RESOLUSI ELEMEN (lakukan berurutan):
     a. Cari berdasarkan aria-label, role, atau placeholder yang relevan.
     b. Cari berdasarkan teks visible (contoh: tombol bertuliskan "Kirim", "Send", "Post", "Tweet", "Search").
     c. Cari berdasarkan atribut data-* (data-testid, data-tooltip, name).
     d. Evaluasi titik tengah elemen dengan elementFromPoint untuk memastikan tidak ada overlay penutup.
   - VERIFIKASI SEBELUM & SETELAH AKSI (Act -> Wait -> Verify):
     * Setelah mengisi field penerima/kolom input autocomplete (Gmail/Search), kirim Enter/Tab lalu verifikasi bahwa chip kontak terbentuk sebelum berpindah ke field berikutnya.
     * Jika muncul dropdown autocomplete yang menutupi tombol eksekusi (seperti tombol Kirim di Gmail), tutup overlay dengan Escape sebelum melakukan klik.
   - BATAS RETRY & CIRCUIT BREAKER:
     * Maksimal 3 percobaan per elemen dengan exponential backoff (500ms, 1000ms, 2000ms).
     * Jika elemen tetap terhalang/tidak ditemukan setelah 3 percobaan, laporkan secara transparan ke pengguna (contoh: "Draf telah tersimpan, silakan klik tombol Kirim secara manual").

2. PROTOKOL ARTIKEL & DOKUMEN BERSTRUKTUR (Structured Article Formatting Protocol):
   - Saat membuat artikel untuk lembar kerja Google Docs / Word:
     * STRUKTUR WAJIB:
       1. Judul Utama (# Judul Bernas & Catchy)
       2. Ringkasan Eksekutif (> 1-2 kalimat esensi utama)
       3. Sub-heading (## Sub-topik) dengan paragraf padat (maksimal 4 kalimat per paragraf)
       4. Bullet Points (3-5 poin ringkas untuk daftar wawasan)
       5. Kesimpulan prospektif yang actionable
     * DILARANG menggunakan tanda kurung siku placeholder ([Judul...]) atau template kosong.

3. PROTOKOL ANTI-DUPLIKASI KOMPOSER MEDSOS (Social Composer Anti-Duplication Protocol):
   - Saat menyisipkan konten ke Twitter/X, LinkedIn, atau Facebook:
     * TULIS SEKALI (Single-pass): Tuliskan seluruh teks sekaligus, jangan mengetik karakter demi karakter untuk hashtag agar tidak memicu popover autosuggest berulang.
     * TUTUP AUTOCOMPLETE DENGAN ESCAPE: Jika popover saran hashtag/kontak muncul, tutup dengan Escape. JANGAN tekan Enter/Tab/Space saat mengetik hashtag di composer.
     * BATASAN HASHTAG: Sisipkan HANYA 1-2 hashtag paling relevan di akhir postingan. DILARANG membuat rentetan hashtag berlebih.
     * BATAS KARAKTER: Pastikan tweet pertama ringkas (<= 240 karakter) agar muat sempurna dalam batas 280 karakter Twitter/X.

4. PROTOKOL EKSTRAKSI TABEL & RISET PRODUK (Table Extraction & Export Protocol):
   - Deteksi elemen <table> standar dan ARIA Data-Grid (role="grid", role="row", role="cell").
   - Identifikasi header kolom sebelum membaca baris data.
   - Sajikan laporan riset dalam format Tabel Komparasi Produk Terstruktur (Nama, Harga, Rating, Toko, Keunggulan) + Rekomendasi (Best Overall, Best Value, Best Performance).
   - Dukung ekspor langsung ke format CSV / Excel (RFC 4180 compliant).`;

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
