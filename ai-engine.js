// ai-engine.js - Agentic Autonomous Browser Engine & PesatRouter Bridge
(() => {
  const DEFAULT_CF_WORKER = "https://pesat-ai-chrome-agent.senna-947.workers.dev";
  const DEFAULT_PESATROUTER = "https://api.pesatrouter.com/v1";

  const SYSTEM_CHAT_PROMPT = `Anda adalah Pesat AI - Asisten profesional untuk analisis konten web, audit SEO, riset, dan perangkuman dokumen.
Berikan respon dalam format Markdown yang rapi, profesional, dan nyaman dibaca:
- Gunakan struktur judul dan subjudul jelas (###)
- Buat poin-poin penting (bullet points) yang padat dan informatif
- Berikan penekanan teks tebal (**bold**) pada kata kunci penting
- Buat tabel Markdown yang rapi jika menyajikan data metrik/komparasi
- Sajikan kesimpulan dan rekomendasi konkret di akhir respon.
JANGAN berikan format JSON untuk obrolan/analisis, berikan langsung teks Markdown lengkap.`;

  const SYSTEM_AGENTIC_PROMPT = `Anda adalah Pesat AI Agent - Asisten otomatisasi browser otonom cerdas (AGENTIC) untuk membantu produktivitas tim dan mempermudah pekerjaan manusia di browser.
Anda BUKAN sekadar chatbot teks generatif; Anda mengeksekusi aksi nyata fisik di halaman web pengguna secara berurutan sampai tugas selesai tuntas.

ATURAN UTAMA AGENTIC:
1. Jangan hanya memberikan draf teks di chat jika pengguna meminta melakukan aksi nyata di web.
2. Jika instruksi pengguna berisi MULTI-PERINTAH (misal: "Buka gmail lalu kirim pesan ke X dengan subjek Y"), PECAH menjadi subtask berurutan pada fase PLAN:
   - Subtask 1: Buka website tujuan
   - Subtask 2: Klik tombol aksi utama (Compose/Tulis/Editor)
   - Subtask 3: Isi input formulir (Penerima, Subjek, Pesan)
   - Subtask 4: Klik tombol Kirim/Submit
   - Subtask 5: Verifikasi selesai
3. Eksekusi aksi fisik pada elemen web menggunakan ID semantik [@e1, @e2, dst] yang terlihat pada daftar DOM terkini.
4. PANDUAN TUGAS UTAMA:
   - KIRIM EMAIL (GMAIL):
     1) Jika belum di Gmail -> aksi: "navigate", url: "https://mail.google.com"
     2) Klik tombol "Tulis" atau "Compose"
     3) Ketik email penerima pada kolom "Kepada" / "To"
     4) Ketik subjek pada kolom "Subjek" / "Subject"
     5) Ketik pesan pada area editor "Isi pesan" / "Message Body"
     6) Klik tombol "Kirim" / "Send"
     7) Setelah terkirim -> aksi: "finish", isFinished: true
   - GOOGLE SEARCH CONSOLE (GSC):
     Buka https://search.google.com/search-console, lakukan inspeksi URL, cek sitemap/indeks.
   - TULIS ARTIKEL (DOCS / CMS):
     Buka editor web (Google Docs/Medium/Notion), klik area dokumen, ketik paragraf terstruktur.
   - POSTINGAN SOSMED (TWITTER / LINKEDIN):
     Buka platform, fokus ke kolom post/tweet, ketik konten & hashtag, klik tombol post.
   - FIX CODE DI LIVE BROWSER:
     Baca error console, navigasi ke file/baris editor web (GitHub/StackBlitz/Replit), ketik kode perbaikan.

FORMAT RESPON HARUS SELALU JSON VALID (TANPA TEKS DI LUAR JSON):

Untuk Fase PLAN:
{"planner":"analisis rencana kerja","plan":["1. Buka website","2. Klik tombol aksi","3. Isi data input","4. Klik kirim"],"requiresApproval":false}

Untuk Fase ACT (Pilih SATU aksi):
{"thought":"alasan aksi berikutnya","action":"click|type|navigate|scroll|key_combo|paste_text|finish","elementId":"@e1","value":"teks jika type","url":"url jika navigate","isFinished":false,"resultMessage":"pesan akhir jika finish"}

Untuk Fase VALIDATE:
{"verdict":"SUCCESS|CONTINUE|RETRY","summary":"ringkasan hasil langkah","subtaskComplete":true}`;

  const PesatAIEngine = {
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

    async callLLMDirect({ phase, prompt, messages = [], taskState = null, image = null, capabilities = {}, config = {}, signal }) {
      const promptText = prompt || "";
      const apiKey = (config.apiKey || "").trim();
      const model = (config.modelName || "").trim() || "pesat-flash";

      const isChat = phase === "chat";
      const phaseInstruction = `\n[FASE EKSEKUSI SAAT INI]: ${phase.toUpperCase()}\n[STATUS STATE TUGAS]: ${typeof taskState === "string" ? taskState : JSON.stringify(taskState || {})}`;
      const systemInstruction = isChat ? SYSTEM_CHAT_PROMPT : (SYSTEM_AGENTIC_PROMPT + phaseInstruction);

      const payloadMessages = [
        { role: "system", content: systemInstruction },
        ...messages.filter(m => m.role !== "system").slice(-4),
        { role: "user", content: promptText }
      ];

      if (apiKey) {
        const baseUrl = (config.apiBaseUrl || "").trim() || DEFAULT_PESATROUTER;
        const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: payloadMessages,
            temperature: isChat ? 0.3 : 0.1
          }),
          signal: signal
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`API PesatRouter [${res.status}]: ${errText.substring(0, 200)}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || "";
        return {
          reply: content,
          usage: data.usage || null
        };
      } else {
        const workerEndpoint = `${DEFAULT_CF_WORKER}/api/chat`;
        const res = await fetch(workerEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            phase: phase,
            model: model,
            taskState: taskState,
            messages: messages
          }),
          signal: signal
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Server Worker [${res.status}]: ${errText.substring(0, 200)}`);
        }

        const data = await res.json();
        return {
          reply: data.reply || data.response || JSON.stringify(data),
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
