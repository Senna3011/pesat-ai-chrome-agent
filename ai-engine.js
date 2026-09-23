// ai-engine.js - Direct PesatRouter / BYOK & Cloudflare Worker Bridge
(() => {
  const DEFAULT_CF_WORKER = "https://pesat-ai-chrome-agent.senna-947.workers.dev";
  const DEFAULT_PESATROUTER = "https://api.pesatrouter.com/v1";

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

      const systemInstruction = `Anda adalah Pesat AI Agent - Asisten otomatisasi browser otonom cerdas untuk membantu pekerjaan manusia (kirim email, tulis artikel di docs/cms, coding & fixing bug web, posting sosmed, pengisian form).
Output HARUS selalu berupa format JSON valid tanpa teks di luar JSON.

Fase saat ini: ${phase.toUpperCase()}
Konteks tugas: ${typeof taskState === "string" ? taskState : JSON.stringify(taskState || {})}

Format output JSON:
Fase PLAN:
{"planner":"analisis langkah","plan":["langkah 1","langkah 2"],"requiresApproval":false}

Fase ACT:
{"thought":"alasan aksi","action":"click|type|navigate|scroll|key_combo|paste_text|finish","elementId":"@e1","value":"teks input jika ada","url":"url jika navigate","isFinished":false,"resultMessage":"pesan jika selesai"}

Fase VALIDATE:
{"verdict":"SUCCESS|CONTINUE|RETRY","summary":"status kemajuan","nextHint":"saran berikutnya"}`;

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
            temperature: 0.15
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
