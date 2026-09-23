// ai-engine.js - Robust Multi-Phase AI Engine & PesatRouter / Cloudflare Worker Bridge
(() => {
  const DEFAULT_CF_WORKER = "https://pesat-ai-chrome-agent.senna-947.workers.dev";
  const DEFAULT_PESATROUTER = "https://api.pesatrouter.com/v1";

  // Common URL shortcuts for human-assist instant navigation
  const QUICK_INTENTS = {
    gmail: "https://mail.google.com",
    email: "https://mail.google.com",
    "google mail": "https://mail.google.com",
    "google docs": "https://docs.google.com",
    docs: "https://docs.google.com",
    "google sheets": "https://sheets.google.com",
    sheets: "https://sheets.google.com",
    spreadsheet: "https://sheets.google.com",
    youtube: "https://www.youtube.com",
    google: "https://www.google.com",
    github: "https://github.com",
    twitter: "https://x.com",
    x: "https://x.com",
    linkedin: "https://www.linkedin.com",
    facebook: "https://www.facebook.com",
    instagram: "https://www.instagram.com",
    chatgpt: "https://chatgpt.com",
    notion: "https://www.notion.so"
  };

  function detectQuickNavigationIntent(text) {
    if (!text || typeof text !== "string") return null;
    const p = text.toLowerCase().trim();
    
    // Check direct shortcut matching
    for (const [key, url] of Object.entries(QUICK_INTENTS)) {
      const reg = new RegExp(`^(?:buka|kunjungi|open|go\\s+to|navigate\\s+to)?\\s*${key}\\s*$`, "i");
      if (reg.test(p)) return url;
    }

    const navMatch = p.match(/(?:buka|kunjungi|open|go to|navigate to)\s+([a-z0-9\s.-]+)/i);
    if (!navMatch) return null;
    const target = navMatch[1].trim();

    if (QUICK_INTENTS[target]) {
      return QUICK_INTENTS[target];
    }
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(target)) {
      return target.startsWith("http") ? target : `https://${target}`;
    }
    return null;
  }

  const PesatAIEngine = {
    async testConnection(cfg = {}) {
      const baseUrl = (cfg.apiBaseUrl || "").trim() || DEFAULT_PESATROUTER;
      const apiKey = (cfg.apiKey || "").trim();
      const model = (cfg.modelName || "").trim() || "pesat-flash";

      try {
        if (apiKey) {
          const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: "user", content: "test" }],
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
          // Cloudflare Worker ping test
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
            throw new Error(`Cloudflare Worker status ${res.status}`);
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
      const baseUrl = (config.apiBaseUrl || "").trim() || (apiKey ? DEFAULT_PESATROUTER : DEFAULT_CF_WORKER);
      const model = (config.modelName || "").trim() || "pesat-flash";

      // Ekstrak goal user jika ada
      const userGoal = (typeof taskState === "object" && taskState?.goal) ? taskState.goal : "";

      // 1. Cek fast-path intent navigasi instan tanpa lola
      const quickUrl = detectQuickNavigationIntent(userGoal) || detectQuickNavigationIntent(promptText);
      if (quickUrl) {
        if (phase === "plan") {
          return {
            reply: JSON.stringify({
              planner: `Membuka alamat website ${quickUrl}.`,
              plan: [`Buka ${quickUrl}`],
              requiresApproval: false
            })
          };
        } else if (phase === "act") {
          return {
            reply: JSON.stringify({
              thought: `Membuka ${quickUrl} ke tab aktif.`,
              action: "navigate",
              value: quickUrl,
              url: quickUrl,
              isFinished: true,
              resultMessage: `Halaman ${quickUrl} berhasil dibuka.`
            })
          };
        } else if (phase === "validate") {
          return {
            reply: JSON.stringify({
              verdict: "SUCCESS",
              summary: `Navigasi ke ${quickUrl} selesai.`,
              subtaskComplete: true
            })
          };
        }
      }

      // 2. Susun system instruction
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

      // 3. Eksekusi Request
      if (apiKey) {
        // Direct call to PesatRouter / OpenAI-compatible
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
            temperature: 0.15,
            response_format: { type: "json_object" }
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
        // Call via Cloudflare Worker proxy
        const workerEndpoint = baseUrl.includes("/api/chat") ? baseUrl : `${baseUrl.replace(/\/+$/, "")}/api/chat`;
        const res = await fetch(workerEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: userGoal || promptText,
            phase: phase,
            model: model,
            taskState: taskState,
            messages: messages
          }),
          signal: signal
        });

        if (!res.ok) {
          if (quickUrl) {
            return {
              reply: JSON.stringify({
                thought: `Membuka ${quickUrl} via fallback.`,
                action: "navigate",
                value: quickUrl,
                url: quickUrl,
                isFinished: true,
                resultMessage: `Halaman ${quickUrl} dibuka.`
              })
            };
          }
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

  // Compatibility alias
  if (typeof globalThis !== "undefined") {
    globalThis.PesatAIEngine = PesatAIEngine;
    globalThis.PesatAiEngine = PesatAIEngine;
  }
})();
