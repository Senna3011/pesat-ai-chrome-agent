// config.js - Global configuration & defaults for Pesat AI Chrome Extension
(() => {
  const PESAT_CONFIG = {
    DEFAULT_API_URL: "https://pesat-ai-chrome-agent.senna-947.workers.dev",
    DEFAULT_PESATROUTER_URL: "https://api.pesatrouter.com/v1",
    DEFAULT_MODEL: "pesat-flash",
    AVAILABLE_MODELS: [
      { id: "pesat-flash", name: "Pesat Flash (Cepat & Cerdas)", contextLimit: 32000, default: true },
      { id: "pesat-pro", name: "Pesat Pro (Penalaran Mendalam)", contextLimit: 128000 },
      { id: "pesat-lite", name: "Pesat Lite (Ringan & Hemat)", contextLimit: 16000 }
    ],
    STORAGE_KEYS: {
      API_URL: "apiUrl",
      API_KEY: "apiKey",
      API_FORMAT: "apiFormat",
      ACTIVE_MODEL: "activeModel",
      MODELS_LIST: "modelsList",
      SESSION_ONLY: "sessionOnly",
      GOOGLE_CLIENT_ID: "googleClientId",
      GOOGLE_AUTH_TOKEN: "googleAuthToken",
      GOOGLE_USER_EMAIL: "googleUserEmail",
      TODAY_REQUESTS: "todayRequests",
      TODAY_TOKENS: "todayTokens",
      TODAY_DATE: "todayDate",
      ONBOARDING_COMPLETED: "onboardingCompleted",
      PROVIDER_ENABLED: "providerEnabled"
    },
    LIMITS: {
      FREE_TIER_DAILY_REQUESTS: 40,
      MAX_CONTEXT_FILES: 5,
      MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024 // 10MB
    },
    SYSTEM_SKILLS: [
      "email_automation",
      "code_fix_editor",
      "article_writer",
      "social_media_poster",
      "form_autofill",
      "data_extraction"
    ]
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PESAT_CONFIG = PESAT_CONFIG;
  }
})();
