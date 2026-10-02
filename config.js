// config.js - Global configuration & defaults for Pesat AI Chrome Extension
(() => {
  const PESAT_CONFIG = {
    DEFAULT_API_BASE_URL: "https://api.pesatrouter.com/v1",
    DEFAULT_MODEL: "pesat-flash",
    DEFAULT_API_FORMAT: "openai-chat",
    DEFAULT_MODELS: [
      { id: "pesat-flash", name: "Pesat Flash (Cepat & Cerdas)", context: "32K", enabled: true, provider: "pesat", badge: "Fast" },
      { id: "pesat-pro", name: "Pesat Pro (Penalaran Mendalam)", context: "128K", enabled: true, provider: "pesat", badge: "Smart" },
      { id: "gpt-4o", name: "GPT-4o (OpenAI Flagship)", context: "128K", enabled: true, provider: "openai", badge: "BYOK" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Google)", context: "1M", enabled: true, provider: "google", badge: "BYOK" },
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet (Anthropic)", context: "200K", enabled: true, provider: "anthropic", badge: "BYOK" },
      { id: "deepseek-chat", name: "DeepSeek V3 (DeepSeek)", context: "64K", enabled: true, provider: "deepseek", badge: "BYOK" }
    ],
    MAX_STEPS: 30,
    MAX_RETRIES_PER_SUBTASK: 3,
    MAX_REPLANS: 2,
    SCRATCHPAD_TAIL: 8
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PESAT_CONFIG = PESAT_CONFIG;
  }
})();
