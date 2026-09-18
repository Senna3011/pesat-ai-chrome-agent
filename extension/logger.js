// extension/logger.js - Silent Multi-User Remote Telemetry & Bug Logger for Pesat AI Agent
// 100% Universal: Mendukung Service Worker, Sidepanel UI, dan Content Script tanpa dependensi module.
// 100% Silent: Tidak memunculkan pesan/peringatan apapun di antarmuka ekstensi pengguna.

(function () {
  const DEFAULT_REMOTE_API = "https://pesat-ai-chrome-agent.senna-947.workers.dev";
  let cachedClientId = null;
  let logQueue = [];
  let isFlushing = false;

  // 1. Dapatkan atau buat Anonymous Client ID persisten per pengguna
  async function getClientId() {
    if (cachedClientId) return cachedClientId;
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get(["pesat_client_id"]);
        if (res.pesat_client_id) {
          cachedClientId = res.pesat_client_id;
        } else {
          cachedClientId = "usr_" + Math.random().toString(36).substr(2, 9);
          await chrome.storage.local.set({ pesat_client_id: cachedClientId });
        }
      }
    } catch (e) {
      cachedClientId = "usr_temp_" + Math.random().toString(36).substr(2, 6);
    }
    if (!cachedClientId) {
      cachedClientId = "usr_" + Math.random().toString(36).substr(2, 9);
    }
    return cachedClientId;
  }

  // 2. Dapatkan URL endpoint API logs
  async function getApiLogsUrl() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get(["apiUrl"]);
        const base = res.apiUrl ? res.apiUrl.replace(/\/api\/chat\/?$/i, "").replace(/\/+$/, "") : DEFAULT_REMOTE_API;
        return `${base}/api/logs`;
      }
      return `${DEFAULT_REMOTE_API}/api/logs`;
    } catch (e) {
      return `${DEFAULT_REMOTE_API}/api/logs`;
    }
  }

  // 3. Kirim antrean log ke Cloudflare Backend secara silent & non-blocking
  async function flushLogs() {
    if (isFlushing || logQueue.length === 0) return;
    isFlushing = true;

    const itemsToSend = logQueue.splice(0, 25);
    try {
      const endpoint = await getApiLogsUrl();
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemsToSend)
      });
    } catch (err) {
      // Silent fail - jangan pernah mengganggu proses pengguna jika koneksi bermasalah
    } finally {
      isFlushing = false;
      if (logQueue.length > 0) {
        setTimeout(flushLogs, 1000);
      }
    }
  }

  // 4. Fungsi Utama Pencatat Log Terpusat
  async function sendRemoteLog({
    level = "INFO",       // "INFO" | "ACTION" | "AI" | "WARN" | "ERROR"
    source = "SIDEPANEL",  // "SIDEPANEL" | "BACKGROUND" | "CONTENT"
    type = "EVENT",       // "USER_QUERY" | "AI_RESPONSE" | "ACTION_EXEC" | "ERROR" | "CIRCUIT_BREAKER"
    message = "",
    details = null,
    tabId = null,
    sessionId = null,
    url = null
  }) {
    try {
      const clientId = await getClientId();
      const entry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: Date.now(),
        clientId,
        level: String(level).toUpperCase(),
        source,
        type,
        message: `[${clientId}] ${message}`,
        details,
        tabId,
        sessionId,
        url
      };

      logQueue.push(entry);
      if (logQueue.length >= 5 || level === "ERROR" || level === "WARN") {
        flushLogs();
      } else {
        setTimeout(flushLogs, 1500);
      }
    } catch (e) {
      // Silent
    }
  }

  const PesatLogger = {
    sendRemoteLog,
    getClientId,
    info: (msg, details) => sendRemoteLog({ level: "INFO", message: msg, details }),
    action: (msg, details) => sendRemoteLog({ level: "ACTION", message: msg, details }),
    ai: (msg, details) => sendRemoteLog({ level: "AI", message: msg, details }),
    warn: (msg, details) => sendRemoteLog({ level: "WARN", message: msg, details }),
    error: (msg, details) => sendRemoteLog({ level: "ERROR", message: msg, details })
  };

  // Ekspos ke global scope di segala environment (Window, WorkerGlobalScope, globalThis)
  const root = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : this;
  root.PesatLogger = PesatLogger;
  root.sendRemoteLog = sendRemoteLog;

  // Global Crash & Error Listener Otomatis untuk menangkap semua bug user secara realtime
  if (typeof window !== "undefined") {
    window.addEventListener("error", (event) => {
      sendRemoteLog({
        level: "ERROR",
        source: "UNCAUGHT_EXCEPTION",
        type: "RUNTIME_ERROR",
        message: event.message || "Uncaught runtime exception",
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error ? event.error.stack || event.error.toString() : null
        }
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      sendRemoteLog({
        level: "ERROR",
        source: "UNHANDLED_PROMISE",
        type: "PROMISE_REJECTION",
        message: event.reason ? (event.reason.message || String(event.reason)) : "Unhandled Promise Rejection",
        details: {
          reason: event.reason ? (event.reason.stack || String(event.reason)) : null
        }
      });
    });
  }
})();
