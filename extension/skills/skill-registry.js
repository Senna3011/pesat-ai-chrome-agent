// skills/skill-registry.js - Central Registry & Router for Agent Skills (skills.sh standard)
(() => {
  const registeredSkills = new Map();

  const SkillRegistry = {
    registerSkill(skill) {
      if (!skill || !skill.name) return;
      registeredSkills.set(skill.name, skill);
    },

    getSkill(name) {
      return registeredSkills.get(name);
    },

    getAllSkills() {
      return Array.from(registeredSkills.values());
    },

    getAllTools() {
      const tools = [];
      for (const skill of registeredSkills.values()) {
        if (Array.isArray(skill.tools)) {
          tools.push(...skill.tools);
        }
      }
      return tools;
    },

    getSystemPromptAdditions() {
      let promptText = "\n\n=== SPESIALISASI SKILL & CAPABILITIES (skills.sh standard) ===\n";
      for (const skill of registeredSkills.values()) {
        if (skill.systemPromptRules) {
          promptText += skill.systemPromptRules + "\n";
        }
      }
      return promptText;
    },

    findSkillForTool(toolName) {
      for (const skill of registeredSkills.values()) {
        if (Array.isArray(skill.tools)) {
          const match = skill.tools.some((t) => t.function?.name === toolName);
          if (match) return skill;
        }
      }
      return null;
    },

    async executeSkill(toolName, params, ctx = {}) {
      const skill = this.findSkillForTool(toolName);
      if (!skill) {
        return null; // Not handled by skills, falls back to native agentic tools
      }

      try {
        return await skill.execute(toolName, params, ctx);
      } catch (err) {
        return {
          success: false,
          error: `Error saat mengeksekusi skill '${skill.name}' [${toolName}]: ${err.message}`
        };
      }
    }
  };

  // Auto-register built-in skills if loaded
  function initAutoRegister() {
    if (globalThis.PesatVisionOCRSkill) SkillRegistry.registerSkill(globalThis.PesatVisionOCRSkill);
    if (globalThis.PesatWebScraperSkill) SkillRegistry.registerSkill(globalThis.PesatWebScraperSkill);
    if (globalThis.PesatFormEngineSkill) SkillRegistry.registerSkill(globalThis.PesatFormEngineSkill);
    if (globalThis.PesatGWorkspaceMCPSkill) SkillRegistry.registerSkill(globalThis.PesatGWorkspaceMCPSkill);
    if (globalThis.PesatDocExportSkill) SkillRegistry.registerSkill(globalThis.PesatDocExportSkill);
  }

  initAutoRegister();

  if (typeof globalThis !== "undefined") {
    globalThis.PesatSkillRegistry = SkillRegistry;
    globalThis.initPesatSkills = initAutoRegister;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = SkillRegistry;
  }
})();
