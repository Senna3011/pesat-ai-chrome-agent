// config.js - Global configuration & defaults for Pesat AI Chrome Extension
(() => {
  const PESAT_CONFIG = {
    DEFAULT_API_BASE_URL: "https://api.pesatrouter.com/v1",
    DEFAULT_MODEL: "pesat-flash",
    DEFAULT_API_FORMAT: "openai-chat",
    DEFAULT_MODELS: [
      { id: "pesat-flash", name: "Pesat Flash (Cepat & Cerdas)", context: "32K", enabled: true },
      { id: "pesat-pro", name: "Pesat Pro (Penalaran Mendalam)", context: "128K", enabled: true },
      { id: "pesat-lite", name: "Pesat Lite (Ringan & Hemat)", context: "16K", enabled: true }
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
