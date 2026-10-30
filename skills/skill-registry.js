// skills/skill-registry.js - Single metadata, validation, redaction, and execution registry
(() => {
  const registeredSkills = new Map();
  const registeredTools = new Map();
  const core = () => globalThis.PesatAgentEngine || (typeof require === "function" ? require("../agent-engine.js") : null);

  const NATIVE_TOOLS = [
    {
      type: "function",
      function: {
        name: "navigate_to",
        description: "Berpindah atau membuka URL HTTP/HTTPS pada tab aktif.",
        parameters: { type: "object", properties: { url: { type: "string", pattern: "^https?://", maxLength: 2048 } }, required: ["url"], additionalProperties: false }
      },
      metadata: { sideEffect: "local", risk: "medium", timeout: 10000, redactFields: [] }
    },
    {
      type: "function",
      function: {
        name: "click_element",
        description: "Mengklik satu elemen menggunakan ID semantik, teks terlihat, atau selector.",
        parameters: {
          type: "object",
          properties: {
            elementId: { type: "string", maxLength: 80 }, targetText: { type: "string", maxLength: 300 }, selector: { type: "string", maxLength: 500 }
          },
          additionalProperties: false
        }
      },
      metadata: { sideEffect: "local", risk: "medium", timeout: 10000, redactFields: [] }
    },
    {
      type: "function",
      function: {
        name: "type_text",
        description: "Mengisi teks pada satu input/editor.",
        parameters: {
          type: "object",
          properties: {
            elementId: { type: "string", maxLength: 80 }, targetText: { type: "string", maxLength: 300 },
            text: { type: "string", maxLength: 50000 }, pressEnter: { type: "boolean" }
          },
          required: ["text"], additionalProperties: false
        }
      },
      metadata: { sideEffect: "local", risk: "medium", timeout: 10000, redactFields: ["text"] }
    },
    {
      type: "function",
      function: {
        name: "press_key",
        description: "Menekan satu tombol keyboard yang diizinkan.",
        parameters: {
          type: "object",
          properties: {
            key: { type: "string", enum: ["Enter", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "Delete"] },
            elementId: { type: "string", maxLength: 80 }
          },
          required: ["key"], additionalProperties: false
        }
      },
      metadata: { sideEffect: "local", risk: "low", timeout: 5000, redactFields: [] }
    },
    {
      type: "function",
      function: {
        name: "ask_user",
        description: "Meminta klarifikasi atau persetujuan pengguna.",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string", minLength: 1, maxLength: 1000 },
            options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 160 } }
          },
          required: ["question"], additionalProperties: false
        }
      },
      metadata: { sideEffect: "none", risk: "low", timeout: 300000, redactFields: [] }
    },
    {
      type: "function",
      function: {
        name: "open_new_tab",
        description: "Membuka tab baru di browser dengan URL yang ditentukan dan mengembalikan tabId.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", pattern: "^https?://", maxLength: 2048 },
            active: { type: "boolean" }
          },
          required: ["url"],
          additionalProperties: false
        }
      },
      metadata: { sideEffect: "local", risk: "medium", timeout: 15000, redactFields: [] }
    },
    {
      type: "function",
      function: {
        name: "switch_to_tab",
        description: "Beralih fokus ke tab browser lain berdasarkan tabId, judul tab, atau URL.",
        parameters: {
          type: "object",
          properties: {
            tabId: { type: "number" },
            matchTitle: { type: "string", maxLength: 300 },
            matchUrl: { type: "string", maxLength: 2048 }
          },
          additionalProperties: false
        }
      },
      metadata: { sideEffect: "local", risk: "low", timeout: 10000, redactFields: [] }
    },
    {
      type: "function",
      function: {
        name: "finish_task",
        description: "Menyelesaikan task hanya setelah verifikasi berhasil.",
        parameters: { type: "object", properties: { message: { type: "string", minLength: 1, maxLength: 4000 } }, required: ["message"], additionalProperties: false }
      },
      metadata: { sideEffect: "none", risk: "low", timeout: 1000, redactFields: [] }
    }
  ];

  function normalizeTool(tool, skill = null) {
    const fn = tool?.function || {};
    const metadata = { ...(tool?.metadata || {}), ...(fn.metadata || {}) };
    return {
      type: "function",
      function: {
        name: fn.name,
        description: fn.description || "",
        parameters: fn.parameters || { type: "object", properties: {} }
      },
      metadata: {
        sideEffect: metadata.sideEffect || "none",
        risk: metadata.risk || "low",
        timeout: Math.min(300000, Math.max(100, Number(metadata.timeout) || 30000)),
        redactFields: Array.isArray(metadata.redactFields) ? metadata.redactFields : [],
        verifier: metadata.verifier || skill?.verify || null,
        executor: metadata.executor || skill?.execute || null,
        skillName: skill?.name || null
      }
    };
  }

  function registerTool(tool, skill = null) {
    const normalized = normalizeTool(tool, skill);
    if (!normalized.function.name) throw new Error("Tool name wajib diisi");
    registeredTools.set(normalized.function.name, normalized);
    return normalized;
  }

  const SkillRegistry = {
    registerSkill(skill) {
      if (!skill || !skill.name) return;
      registeredSkills.set(skill.name, skill);
      for (const tool of skill.tools || []) registerTool(tool, skill);
    },

    registerTool,

    getSkill(name) { return registeredSkills.get(name); },
    getTool(name) { return registeredTools.get(name) || null; },
    getAllSkills() { return Array.from(registeredSkills.values()); },
    getAllTools() {
      return Array.from(registeredTools.values()).map(({ type, function: fn }) => ({ type, function: fn }));
    },
    getToolMetadata(name) {
      const tool = registeredTools.get(name);
      return tool ? { ...tool.metadata, schema: tool.function.parameters, description: tool.function.description } : null;
    },

    validateToolCall(toolName, params) {
      const tool = registeredTools.get(toolName);
      if (!tool) return { valid: false, errorType: "UNSUPPORTED", errors: [`Tool tidak tersedia: ${toolName}`], value: null };
      const engine = core();
      const result = engine?.validateToolArguments
        ? engine.validateToolArguments(params, tool.function.parameters)
        : { valid: params && typeof params === "object" && !Array.isArray(params), errors: ["Argumen harus object"], value: params };
      return { ...result, errorType: result.valid ? null : "INVALID_INPUT" };
    },

    redactToolInput(toolName, params) {
      const tool = registeredTools.get(toolName);
      return core()?.redact?.(params, tool?.metadata?.redactFields || []) || params;
    },

    getSystemPromptAdditions() {
      let promptText = "\n\n=== SPESIALISASI SKILL & CAPABILITIES ===\n";
      for (const skill of registeredSkills.values()) if (skill.systemPromptRules) promptText += skill.systemPromptRules + "\n";
      return promptText;
    },

    findSkillForTool(toolName) {
      const skillName = registeredTools.get(toolName)?.metadata?.skillName;
      return skillName ? registeredSkills.get(skillName) || null : null;
    },

    async executeSkill(toolName, params, ctx = {}) {
      const tool = registeredTools.get(toolName);
      const skill = this.findSkillForTool(toolName);
      if (!tool || !skill) return null;
      const validation = this.validateToolCall(toolName, params);
      if (!validation.valid) {
        return { success: false, errorType: "INVALID_INPUT", error: validation.errors.join("; ") };
      }
      const startedAt = new Date().toISOString();
      const receiptBase = { stepId: ctx.stepId || "", tool: toolName, validatedInput: this.redactToolInput(toolName, validation.value), startedAt };
      try {
        const timeout = tool.metadata.timeout;
        const result = await Promise.race([
          Promise.resolve(skill.execute(toolName, validation.value, ctx)),
          new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(`Tool timeout ${timeout}ms`), { code: "TIMEOUT" })), timeout))
        ]);
        let success = Boolean(result && result.success !== false);
        let verification = [];
        if (success && typeof tool.metadata.verifier === "function") {
          const verified = await tool.metadata.verifier(validation.value, result, ctx);
          verification = Array.isArray(verified?.checks) ? verified.checks : [];
          if (verified?.passed !== true) success = false;
        }
        const errorType = success ? null : (result?.errorType || "VERIFICATION_FAILED");
        const receipt = core()?.createActionReceipt?.({ ...receiptBase, success, errorType, verification });
        return { ...result, success, errorType, verification, receipt };
      } catch (err) {
        const errorType = err.code === "TIMEOUT" ? "TIMEOUT" : "EXECUTION_FAILED";
        return {
          success: false,
          errorType,
          error: `Error saat mengeksekusi skill '${skill.name}' [${toolName}]: ${err.message}`,
          receipt: core()?.createActionReceipt?.({ ...receiptBase, success: false, errorType })
        };
      }
    }
  };

  NATIVE_TOOLS.forEach((tool) => registerTool(tool));

  function initAutoRegister() {
    if (globalThis.PesatVisionOCRSkill) SkillRegistry.registerSkill(globalThis.PesatVisionOCRSkill);
    if (globalThis.PesatWebScraperSkill) SkillRegistry.registerSkill(globalThis.PesatWebScraperSkill);
    if (globalThis.PesatFormEngineSkill) SkillRegistry.registerSkill(globalThis.PesatFormEngineSkill);
    if (globalThis.PesatGWorkspaceMCPSkill) SkillRegistry.registerSkill(globalThis.PesatGWorkspaceMCPSkill);
    if (globalThis.PesatDocExportSkill) SkillRegistry.registerSkill(globalThis.PesatDocExportSkill);
    if (globalThis.PesatKnowledgeSkill) SkillRegistry.registerSkill(globalThis.PesatKnowledgeSkill);
  }

  initAutoRegister();
  if (typeof globalThis !== "undefined") {
    globalThis.PesatSkillRegistry = SkillRegistry;
    globalThis.initPesatSkills = initAutoRegister;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = SkillRegistry;
})();
