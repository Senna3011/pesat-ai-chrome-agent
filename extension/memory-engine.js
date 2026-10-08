// memory-engine.js - Local Episodic Memory & Self-Evolving Skill Engine
(() => {
  const STORAGE_KEY = "pesat_memory_store";

  const defaultStore = {
    profile: [],
    preferences: [],
    guardrails: [],
    skills: []
  };

  let store = { ...defaultStore };
  let isInitialized = false;

  const PesatMemoryEngine = {
    async init() {
      if (isInitialized) return store;
      try {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          const data = await new Promise((resolve) => {
            try {
              chrome.storage.local.get([STORAGE_KEY], (res) => resolve(res || {}));
            } catch (_) {
              resolve({});
            }
          });
          if (data && data[STORAGE_KEY]) {
            store = {
              profile: Array.isArray(data[STORAGE_KEY].profile) ? data[STORAGE_KEY].profile : [],
              preferences: Array.isArray(data[STORAGE_KEY].preferences) ? data[STORAGE_KEY].preferences : [],
              guardrails: Array.isArray(data[STORAGE_KEY].guardrails) ? data[STORAGE_KEY].guardrails : [],
              skills: Array.isArray(data[STORAGE_KEY].skills) ? data[STORAGE_KEY].skills : []
            };
          }
        }
      } catch (err) {
        console.warn("[MemoryEngine] Gagal memuat memori dari storage:", err);
      }
      isInitialized = true;
      return store;
    },

    async save() {
      try {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          await new Promise((resolve) => {
            try {
              chrome.storage.local.set({ [STORAGE_KEY]: store }, () => resolve());
            } catch (_) {
              resolve();
            }
          });
        }
      } catch (err) {
        console.warn("[MemoryEngine] Gagal menyimpan memori:", err);
      }
    },

    getAll() {
      return {
        profile: [...store.profile],
        preferences: [...store.preferences],
        guardrails: [...store.guardrails],
        skills: [...store.skills]
      };
    },

    async add(category, text, extra = {}) {
      await this.init();
      const validCategories = ["profile", "preferences", "guardrails", "skills"];
      const cat = validCategories.includes(category) ? category : "preferences";
      const cleanText = String(text || "").trim();
      if (!cleanText) return null;

      // Cegah duplikasi teks yang sama persis dalam kategori
      const existing = store[cat].find((item) => item.text.toLowerCase() === cleanText.toLowerCase());
      if (existing) {
        existing.updatedAt = Date.now();
        await this.save();
        return existing;
      }

      const item = {
        id: "mem_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        category: cat,
        text: cleanText,
        domain: extra.domain ? String(extra.domain).toLowerCase().trim() : "",
        hitCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      store[cat].unshift(item);
      // Batasi maksimal 40 entri per kategori untuk efisiensi
      if (store[cat].length > 40) {
        store[cat] = store[cat].slice(0, 40);
      }

      await this.save();
      return item;
    },

    async remove(id) {
      await this.init();
      for (const cat of ["profile", "preferences", "guardrails", "skills"]) {
        const idx = store[cat].findIndex((item) => item.id === id);
        if (idx !== -1) {
          store[cat].splice(idx, 1);
          await this.save();
          return true;
        }
      }
      return false;
    },

    async clear(category = null) {
      await this.init();
      if (category && store[category]) {
        store[category] = [];
      } else {
        store = {
          profile: [],
          preferences: [],
          guardrails: [],
          skills: []
        };
      }
      await this.save();
      return true;
    },

    detectAndSaveExplicitMemory(userPrompt) {
      if (!userPrompt || typeof userPrompt !== "string") return null;
      const text = userPrompt.trim();

      // 1. Slash command /ingat atau /remember
      const slashMatch = text.match(/^\/(?:ingat|remember)\s+(.+)$/i);
      if (slashMatch) {
        const fact = slashMatch[1].trim();
        const cat = /jangan|dilarang|never|tidak boleh/i.test(fact) ? "guardrails" : "preferences";
        return this.add(cat, fact);
      }

      // 2. Pattern Pantangan / Guardrails
      const guardMatch = text.match(/(?:jangan pernah|dilarang keras|pantangan(?:\s+saya)?|never ever|hindari selalu)\s*:?\s*(.+)/i);
      if (guardMatch && guardMatch[1].length > 4) {
        return this.add("guardrails", guardMatch[1].trim());
      }

      // 3. Pattern Profil Pengguna
      const profMatch = text.match(/(?:saya adalah|profesi saya|pekerjaan saya|nama saya|bisnis saya|usaha saya|saya pemilik|i am a?)\s*:?\s*(.+)/i);
      if (profMatch && profMatch[1].length > 4) {
        return this.add("profile", profMatch[0].trim());
      }

      // 4. Pattern Preferensi Umum ("Ingat bahwa...", "Mulai sekarang...")
      const prefMatch = text.match(/(?:ingat(?:\s+bahwa)?|remember(?:\s+that)?|mulai sekarang|catat(?:\s+bahwa)?)\s*:?\s*(.+)/i);
      if (prefMatch && prefMatch[1].length > 4) {
        const fact = prefMatch[1].trim();
        const cat = /jangan|dilarang|never/i.test(fact) ? "guardrails" : "preferences";
        return this.add(cat, fact);
      }

      return null;
    },

    async recordLearnedSkill(domain, goal, rule) {
      if (!domain || !rule) return null;
      const cleanDomain = String(domain).replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
      const text = `${goal ? `[Tujuan: ${goal}] ` : ""}${rule}`.trim();
      return this.add("skills", text, { domain: cleanDomain });
    },

    getPromptInjection(currentDomain = "", userPrompt = "") {
      const parts = [];

      // A. Profil Pengguna (Maksimal 3 paling baru)
      if (store.profile.length > 0) {
        const profLines = store.profile.slice(0, 3).map((p) => `- ${p.text}`).join("\n");
        parts.push(`[PROFIL PENGGUNA]:\n${profLines}`);
      }

      // B. Preferensi Output (Maksimal 4)
      if (store.preferences.length > 0) {
        const prefLines = store.preferences.slice(0, 4).map((p) => `- ${p.text}`).join("\n");
        parts.push(`[PREFERENSI PENGGUNA]:\n${prefLines}`);
      }

      // C. Guardrails & Pantangan (Prioritas tinggi)
      if (store.guardrails.length > 0) {
        const guardLines = store.guardrails.slice(0, 4).map((g) => `- ${g.text}`).join("\n");
        parts.push(`[PANTANGAN / LARANGAN PENGGUNA]:\n${guardLines}`);
      }

      // D. Skill & Trik Terpelajar Spesifik Situs (Hanya jika domain cocok)
      if (currentDomain && store.skills.length > 0) {
        const cleanDomain = String(currentDomain).replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
        const relevantSkills = store.skills.filter((s) => s.domain && cleanDomain.includes(s.domain));
        if (relevantSkills.length > 0) {
          const skillLines = relevantSkills.slice(0, 3).map((s) => `- ${s.text}`).join("\n");
          parts.push(`[KEAHLIAN/POLA NAVIGASI SITUS TERPELAJAR (${cleanDomain})]:\n${skillLines}`);
        }
      }

      if (parts.length === 0) return "";
      return `\n\n=== MEMORI & PENGALAMAN TERPELAJAR (PERSISTENT USER MEMORY) ===\n${parts.join("\n\n")}\n===============================================================`;
    }
  };

  globalThis.PesatMemoryEngine = PesatMemoryEngine;
})();
