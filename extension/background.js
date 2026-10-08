// background.js - Service Worker & ReAct Message Orchestrator (MV3 Compliant with Anti-Looping & Human-in-the-Loop)

try {
  importScripts('logger.js');
} catch (e) {
  console.warn("[Pesat SW] Logger import fallback:", e);
}

function bgLog(level, type, message, details = null, tabId = null) {
  try {
    if (typeof sendRemoteLog === "function") {
      sendRemoteLog({ level, source: "BACKGROUND", type, message, details, tabId });
    } else if (globalThis.PesatLogger?.sendRemoteLog) {
      globalThis.PesatLogger.sendRemoteLog({ level, source: "BACKGROUND", type, message, details, tabId });
    }
  } catch (e) {}
}

// Action history tracker untuk pencegahan infinite loop
const actionHistoryPerTab = new Map();

// Task Token Usage Accumulator Tracker
let taskTokenUsage = {
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0
};

// Persistent session storage across MV3 Service Worker terminations
async function hydrateSWState() {
  try {
    const storageArea = chrome.storage?.session || chrome.storage?.local;
    if (storageArea) {
      const data = await storageArea.get(["pesat_sw_token_usage", "pesat_sw_action_history"]);
      if (data.pesat_sw_token_usage) {
        taskTokenUsage = { ...taskTokenUsage, ...data.pesat_sw_token_usage };
      }
      if (data.pesat_sw_action_history && typeof data.pesat_sw_action_history === "object") {
        for (const [k, v] of Object.entries(data.pesat_sw_action_history)) {
          actionHistoryPerTab.set(Number(k), v);
        }
      }
    }
  } catch (_) {}
}

async function persistSWState() {
  try {
    const storageArea = chrome.storage?.session || chrome.storage?.local;
    if (storageArea) {
      const historyObj = {};
      for (const [k, v] of actionHistoryPerTab.entries()) {
        historyObj[k] = v;
      }
      await storageArea.set({
        pesat_sw_token_usage: taskTokenUsage,
        pesat_sw_action_history: historyObj
      });
    }
  } catch (_) {}
}

hydrateSWState();

// Buka side panel otomatis ketika ikon ekstensi di-klik di toolbar
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("[Pesat SW] Error setting panel behavior:", error));

function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "pesat-ask-selection",
      title: "Tanyakan ke Pesat AI",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "pesat-summarize-selection",
      title: "Rangkum Teks Ini",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "pesat-explain-image",
      title: "Jelaskan Gambar Ini (Vision OCR)",
      contexts: ["image"]
    });
    chrome.contextMenus.create({
      id: "pesat-summarize-link",
      title: "Baca & Rangkum Isi Link Ini",
      contexts: ["link"]
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("[Pesat SW] Error setting panel behavior:", error));

  bgLog("INFO", "SW_INSTALLED", "Background Service Worker berhasil diinstal & aktif.");
  console.log("[Pesat AI Agent] Background Service Worker installed successfully.");
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    setupContextMenus();
  });
}

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    try {
      if (tab.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
      }
    } catch (_) {}

    let prompt = "";
    if (info.menuItemId === "pesat-ask-selection" && info.selectionText) {
      prompt = `Tolong jelaskan atau jawab mengenai teks berikut:\n\n"${info.selectionText}"`;
    } else if (info.menuItemId === "pesat-summarize-selection" && info.selectionText) {
      prompt = `Rangkum teks berikut secara padat dan jelas:\n\n"${info.selectionText}"`;
    } else if (info.menuItemId === "pesat-explain-image" && info.srcUrl) {
      prompt = `Jelaskan gambar berikut dari URL:\n${info.srcUrl}`;
    } else if (info.menuItemId === "pesat-summarize-link" && info.linkUrl) {
      prompt = `Buka dan rangkum isi dari tautan ini:\n${info.linkUrl}`;
    }

    if (prompt) {
      const storageArea = chrome.storage.session || chrome.storage.local;
      await storageArea.set({ pesat_pending_prompt: { prompt, timestamp: Date.now() } });
      try {
        chrome.runtime.sendMessage({ action: "INJECT_PENDING_PROMPT", prompt }).catch(() => {});
      } catch (_) {}
    }
  });
}

// Safe Tab Message Dispatcher with Auto-Injection Fallback & SW lifecycle resilience
async function sendTabMessageSafe(tabId, payload) {
  if (!tabId) {
    throw new Error("Tab ID tidak ditemukan.");
  }
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch (err) {
    try {
      // Jika content script belum aktif / tertidur, inject ulang
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
      // Polling tunggu sampai content script siap mendengarkan listener (maksimal 1.5 detik)
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 250));
        try {
          return await chrome.tabs.sendMessage(tabId, payload);
        } catch (_) {}
      }
      return await chrome.tabs.sendMessage(tabId, payload);
    } catch (injectErr) {
      throw new Error(`Komunikasi tab gagal (${tabId}): ${injectErr.message || err.message}`);
    }
  }
}

// Helper: Cek apakah prompt atau instruksi adalah perangkuman halaman
function isSummarizePrompt(text = "") {
  const t = String(text).toLowerCase();
  return (
    t.includes("rangkum") ||
    t.includes("ringkas") ||
    t.includes("summarize") ||
    t.includes("summary") ||
    t.includes("rangkuman") ||
    t.includes("ringkasan")
  );
}

// Helper: Ambil teks artikel bersih (readable text) dari content.js pada tab aktif
async function getReadableTextFromTab(tabId) {
  try {
    const res = await sendTabMessageSafe(tabId, { type: "GET_READABLE_TEXT" });
    return res || { success: false, text: "" };
  } catch (err) {
    return { success: false, text: "", error: err.message };
  }
}

// Helper: Kirim teks artikel ke Cloudflare Pages Function (chat.js)
async function requestSummaryFromAI({ text, title, url, userPrompt, apiUrl, apiKey }) {
  const targetUrl = apiUrl || "https://pesat-ai-chrome-agent.senna-947.workers.dev/";

  const promptPayload = `[TEKS UTAMA ARTIKEL / HALAMAN WEB]
Judul: ${title || "Halaman Web"}
URL: ${url || ""}

${text || "(Tidak ada teks konten terdeteksi)"}

[INSTRUKSI PERANGKUMAN]
${userPrompt || "Tolong buat ringkasan poin-poin penting (bullet points) dari isi substansi informasi/artikel di atas."}`;

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      prompt: promptPayload,
      userQuery: userPrompt,
      isSummarize: true
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Router Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (data.success === false && data.error) {
    throw new Error(data.error);
  }

  return data.reply || "Gagal menghasilkan rangkuman.";
}

// Listener komunikasi pesan dari Side Panel atau Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PING" || request.type === "PING") {
    sendResponse({ status: "OK", message: "Background service worker active", timestamp: Date.now() });
    return true;
  }

  // Safe Action executor
  if (request.type === "EXECUTE_SAFE_ACTION") {
    (async () => {
      try {
        const res = await sendTabMessageSafe(request.tabId, request.payload);
        sendResponse({ success: true, data: res });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Ambil teks murni artikel (Readable Text) secara langsung dari tab aktif atau tab spesifik (tabId)
  if (request.action === "GET_READABLE_TEXT" || request.type === "GET_READABLE_TEXT") {
    const targetTabId = request.tabId || request.payload?.tabId;
    if (targetTabId) {
      getReadableTextFromTab(Number(targetTabId))
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ success: false, text: "", error: err.message }));
      return true;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        sendResponse({ success: false, error: "Tidak ada tab aktif yang ditemukan." });
        return;
      }
      try {
        const res = await getReadableTextFromTab(tabs[0].id);
        sendResponse(res);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  // Handler khusus Perangkuman Halaman (Bypass AXTree DOM & kirim Readable Text murni)
  if (request.action === "SUMMARIZE_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        sendResponse({ success: false, error: "Tidak ada tab aktif yang ditemukan." });
        return;
      }

      const activeTab = tabs[0];
      const tabUrl = activeTab.url || "";

      // Handling internal page
      if (/^(chrome|edge|about|chrome-extension):\/\//i.test(tabUrl) || !tabUrl || tabUrl === "about:blank") {
        sendResponse({
          success: true,
          reply: "⚠️ Halaman internal peramban tidak memiliki artikel/teks untuk dirangkum."
        });
        return;
      }

      try {
        // 1. Panggil GET_READABLE_TEXT ke content.js
        const textData = await getReadableTextFromTab(activeTab.id);
        const articleText = textData.text || "";

        if (!articleText || articleText.length < 20) {
          sendResponse({
            success: true,
            reply: "⚠️ Tidak ditemukan artikel atau teks utama yang cukup untuk dirangkum pada halaman ini."
          });
          return;
        }

        // 2. Kirim teks murni artikel ke Cloudflare Pages Function (chat.js)
        const summary = await requestSummaryFromAI({
          text: articleText,
          title: textData.title || activeTab.title,
          url: textData.url || activeTab.url,
          userPrompt: request.prompt || request.userPrompt,
          apiUrl: request.apiUrl,
          apiKey: request.apiKey
        });

        sendResponse({ success: true, reply: summary, isSummarize: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  // Abort Agent Loop Signal Handler
  if (request.action === "ABORT_AGENT_LOOP" || request.type === "ABORT_AGENT_LOOP") {
    actionHistoryPerTab.clear();
    persistSWState();
    bgLog("WARN", "AGENT_ABORTED", `Siklus AI dihentikan secara paksa: ${request.reason || "Permintaan pengguna"}`, null);

    // Buka lock shield & bersihkan markers di tab aktif
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "UNLOCK_PAGE" }, () => { if (chrome.runtime.lastError) {} });
        chrome.tabs.sendMessage(tabs[0].id, { type: "CLEAR_MARKERS" }, () => { if (chrome.runtime.lastError) {} });
      }
    });

    sendResponse({ success: true, message: "Agent loop aborted successfully" });
    return true;
  }

  // Reset riwayat loop & token accumulator saat memulai sesi obrolan/perintah baru
  if (request.action === "RESET_LOOP_TRACKER" || request.type === "RESET_LOOP_TRACKER") {
    actionHistoryPerTab.clear();
    taskTokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    persistSWState();
    sendResponse({ success: true, taskTokenUsage });
    return true;
  }

  // Token Usage Tracking Handlers
  if (request.action === "RECORD_TOKEN_USAGE" || request.type === "RECORD_TOKEN_USAGE") {
    const usage = request.usage || {};
    taskTokenUsage.prompt_tokens += (Number(usage.prompt_tokens) || 0);
    taskTokenUsage.completion_tokens += (Number(usage.completion_tokens) || 0);
    taskTokenUsage.total_tokens += (Number(usage.total_tokens) || ((Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0)));
    persistSWState();

    // Broadcast update token ke seluruh view yang aktif
    try {
      chrome.runtime.sendMessage({
        type: "TOKEN_UPDATE",
        usage: { ...taskTokenUsage }
      }).catch(() => {});
    } catch (_) {}

    sendResponse({ success: true, taskTokenUsage });
    return true;
  }

  if (request.action === "GET_TOKEN_USAGE" || request.type === "GET_TOKEN_USAGE") {
    sendResponse({ success: true, taskTokenUsage });
    return true;
  }

  // Bug Report Collector Handler
  if (request.action === "SUBMIT_BUG_REPORT" || request.type === "SUBMIT_BUG_REPORT") {
    (async () => {
      try {
        let activeTabUrl = "";
        let activeTabTitle = "";
        let activeTabId = null;

        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs[0]) {
            activeTabUrl = tabs[0].url || "";
            activeTabTitle = tabs[0].title || "";
            activeTabId = tabs[0].id || null;
          }
        } catch (_) {}

        const reportPayload = {
          userDescription: request.userDescription || request.description || "Tidak ada deskripsi",
          url: request.url || activeTabUrl,
          tabTitle: activeTabTitle,
          tabId: activeTabId,
          lastError: request.lastError || null,
          actionLogs: request.actionLogs || [],
          domSnapshot: request.includeDom ? request.domSnapshot : null,
          reportedAt: new Date().toISOString()
        };

        try {
          await fetch("https://pesat-ai-chrome-agent.senna-947.workers.dev/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: "GENERAL_BUG",
              title: `[User Report] ${reportPayload.userDescription.slice(0, 60)}`,
              description: reportPayload.userDescription,
              url: reportPayload.url,
              recentLogs: reportPayload.actionLogs,
              extraContext: { tabTitle: reportPayload.tabTitle, lastError: reportPayload.lastError }
            })
          }).catch(() => {});
        } catch (_) {}

        // 1. Kirim single telemetry log ke Cloudflare Worker
        const reportLogEntry = {
          level: "WARN",
          source: "USER_BUG_REPORT",
          type: "BUG_REPORT",
          message: `[BUG REPORT] ${reportPayload.userDescription}`,
          details: reportPayload,
          tabId: activeTabId,
          url: reportPayload.url,
          timestamp: Date.now()
        };

        try {
          await fetch("https://pesat-ai-chrome-agent.senna-947.workers.dev/api/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reportLogEntry)
          }).catch(() => {});
        } catch (_) {}

        // 2. Simpan backup lokal di chrome.storage.local
        chrome.storage.local.get(["pesat_bug_reports"], (res) => {
          const reports = res.pesat_bug_reports || [];
          reports.unshift({ ...reportPayload, timestamp: Date.now() });
          chrome.storage.local.set({ pesat_bug_reports: reports.slice(0, 50) });
        });

        sendResponse({ success: true, message: "Laporan bug berhasil dikirim dan dicatat!" });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 3. Tab Management & Vision Handlers
  if (request.action === "SCREENSHOT") {
    try {
      chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({ success: false, error: chrome.runtime.lastError?.message || "Screenshot gagal" });
        } else {
          sendResponse({ success: true, dataUrl });
        }
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (request.action === "LIST_TABS") {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const tabList = (tabs || []).map((t, idx) => ({
        tabId: t.id,
        title: t.title || "Tab",
        url: t.url || "",
        active: !!t.active,
        label: `[@tab${idx + 1}]`
      }));
      sendResponse({ success: true, tabs: tabList });
    });
    return true;
  }

  if (request.action === "SWITCH_TAB") {
    const targetId = request.tabId;
    if (targetId) {
      chrome.tabs.update(Number(targetId), { active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, tab });
        }
      });
    } else {
      sendResponse({ success: false, error: "Target tabId tidak ditemukan." });
    }
    return true;
  }

  if (request.action === "NEW_TAB") {
    const raw = request.url || request.value || "https://www.google.com";
    const dest = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    chrome.tabs.create({ url: dest }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, tabId: tab.id });
      }
    });
    return true;
  }

  if (request.action === "CLOSE_TAB") {
    const targetId = request.tabId;
    if (targetId) {
      chrome.tabs.remove(Number(targetId), () => {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: "tabId tidak valid." });
    }
    return true;
  }

  if (request.action === "DOWNLOAD_FILE") {
    try {
      const params = request.params || request;
      const filename = params.filename || `pesat-export-${Date.now()}.csv`;
      const content = params.content || "";
      const mimeType = params.mimeType || "text/csv;charset=utf-8";

      const dataUrl = `data:${mimeType},${encodeURIComponent(content)}`;
      if (chrome.downloads?.download) {
        chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true, downloadId, filename });
          }
        });
      } else {
        sendResponse({ success: true, dataUrl, filename });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (request.action === "GOOGLE_STATUS") {
    const storageArea = (chrome.storage && chrome.storage.session) ? chrome.storage.session : chrome.storage.local;
    storageArea.get(["googleAuthToken", "googleUserEmail"], (res) => {
      if (res && res.googleAuthToken) {
        sendResponse({ connected: true, email: res.googleUserEmail || "" });
      } else {
        chrome.storage.local.get(["googleAuthToken", "googleUserEmail"], (localRes) => {
          sendResponse({ connected: Boolean(localRes && localRes.googleAuthToken), email: localRes?.googleUserEmail || "" });
        });
      }
    });
    return true;
  }

  if (request.action === "GOOGLE_CONNECT") {
    (async () => {
      try {
        const customClientId = request.clientId;
        const data = await chrome.storage.local.get(["googleClientId"]);
        const clientId = customClientId || data.googleClientId || "";

        if (!clientId) {
          sendResponse({
            success: false,
            error: "Google Client ID belum diisi. Masukkan Google Client ID di menu Pengaturan Lanjut jika ingin menggunakan API Latar Belakang."
          });
          return;
        }

        const redirectUri = chrome.identity.getRedirectURL("goog");
        const scopes = [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/documents",
          "https://www.googleapis.com/auth/userinfo.email"
        ].join(" ");

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&prompt=consent`;

        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (responseUrl) => {
          if (chrome.runtime.lastError || !responseUrl) {
            sendResponse({ success: false, error: chrome.runtime.lastError?.message || "Autentikasi Google dibatalkan." });
            return;
          }
          try {
            const urlObj = new URL(responseUrl);
            const params = new URLSearchParams(urlObj.hash.substring(1));
            const token = params.get("access_token");
            if (token) {
              const storageArea = (chrome.storage && chrome.storage.session) ? chrome.storage.session : chrome.storage.local;
              await storageArea.set({ googleAuthToken: token });
              // Ambil info email user
              try {
                const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (userRes.ok) {
                  const userData = await userRes.json();
                  if (userData.email) await storageArea.set({ googleUserEmail: userData.email });
                }
              } catch (_) {}

              sendResponse({ success: true, message: "Berhasil terhubung ke Google Workspace!" });
            } else {
              sendResponse({ success: false, error: "Gagal mendapatkan access token dari Google." });
            }
          } catch (e) {
            sendResponse({ success: false, error: e.message });
          }
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === "GOOGLE_DISCONNECT") {
    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.remove(["googleAuthToken", "googleUserEmail"], () => {});
    }
    chrome.storage.local.remove(["googleAuthToken", "googleUserEmail"], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "TOGGLE_SIDEPANEL") {
    const tabId = sender.tab?.id;
    const winId = sender.tab?.windowId;
    if (chrome.sidePanel?.open) {
      (async () => {
        let opened = false;
        if (tabId) {
          try {
            await chrome.sidePanel.open({ tabId });
            opened = true;
          } catch (_) {}
        }
        if (!opened && winId) {
          try {
            await chrome.sidePanel.open({ windowId: winId });
            opened = true;
          } catch (_) {}
        }
        sendResponse({ success: opened });
      })().catch((e) => {
        sendResponse({ success: false, error: e.message });
      });
      return true;
    }
    sendResponse({ success: false, error: "Sidepanel API not supported" });
    return true;
  }

  if (request.action === "IN_PAGE_AI_QUERY") {
    (async () => {
      try {
        const { taskType, selectedText, customPrompt } = request;
        let instruction = "";
        if (taskType === "search_copilot") {
          instruction = `Pengguna mencari di search engine: "${selectedText}".
Sajikan ringkasan wawasan langsung yang padat, akurat, dan sangat enak dibaca:
1. Jika berupa tempat/toko/bisnis: sebutkan nama resmi, lokasi ringkas, konsep, menu/layanan utama, dan fasilitas penting.
2. Jika berupa konsep/pertanyaan/topik: sajikan jawaban inti langsung dalam 2-3 poin kunci.
Gunakan format poin (- **Label:** Penjelasan) yang rapi tanpa basa-basi pembuka atau penutup.`;
        } else if (taskType === "summarize") {
          instruction = `Rangkum teks berikut secara padat dan jelas dalam 2-3 poin penting:\n\n"${selectedText}"`;
        } else if (taskType === "translate") {
          instruction = `Terjemahkan teks berikut ke Bahasa Indonesia (atau ke Bahasa Inggris jika teks aslinya Bahasa Indonesia):\n\n"${selectedText}"`;
        } else if (taskType === "explain") {
          instruction = `Jelaskan istilah penting atau substansi teks berikut secara ringkas dan informatif:\n\n"${selectedText}"`;
        } else if (taskType === "polish") {
          instruction = `Perbaiki tata bahasa, ejaan, dan struktur teks berikut agar lebih profesional tanpa mengubah makna aslinya:\n\n"${selectedText}"`;
        } else {
          instruction = customPrompt || selectedText;
        }

        const storageData = await chrome.storage.local.get(["apiKey", "apiBaseUrl", "modelName"]);
        const apiKey = storageData.apiKey || "";
        const apiUrl = storageData.apiBaseUrl || "https://api.pesatrouter.com/v1";
        const model = storageData.modelName || "pesat-flash";

        const endpoint = apiUrl.endsWith("/chat/completions") ? apiUrl : `${apiUrl.replace(/\/+$/, "")}/chat/completions`;
        const systemPrompt = taskType === "search_copilot"
          ? "Kamu adalah Pesat AI Web Copilot. Berikan intisari informasi yang sangat rapi, akurat, dan langsung menjawab pencarian pengguna tanpa kalimat pembuka atau penutup klise."
          : "Kamu adalah asisten in-page cepat dari Pesat AI. Berikan jawaban yang padat, presisi, dan langsung ke inti jawaban tanpa basa-basi pembuka/penutup.";

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
          },
          body: JSON.stringify({
            model,
            max_tokens: 800,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: instruction }
            ]
          })
        });

        if (!res.ok) {
          const errTxt = await res.text().catch(() => "");
          throw new Error(`API error ${res.status}: ${errTxt}`);
        }
        const data = await res.json();
        const choice = data.choices?.[0];
        const reply = (choice?.message?.content !== undefined && choice?.message?.content !== null && choice?.message?.content !== "")
          ? choice.message.content
          : (choice?.message?.reasoning_content || data.reply || "Tidak ada respon.");
        sendResponse({ success: true, reply });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Navigasi URL tab aktif secara langsung via Chrome Tabs API (aman untuk chrome://newtab, about:blank dll)
  if (request.action === "NAVIGATE_TAB" || request.action === "navigate_to") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        sendResponse({ success: false, error: "Tidak ada tab aktif yang ditemukan." });
        return;
      }
      try {
        let rawUrl = (request.url || request.value || "").trim();
        if (!rawUrl || rawUrl === "undefined" || rawUrl === "null") {
          sendResponse({ success: false, error: "URL tujuan navigasi kosong atau tidak valid." });
          return;
        }

        let url = rawUrl;
        if (!/^https?:\/\//i.test(url)) {
          if (url.includes(".") || url.startsWith("localhost")) {
            url = "https://" + url;
          } else {
            url = "https://www.google.com/search?q=" + encodeURIComponent(url);
          }
        }

        actionHistoryPerTab.delete(tabs[0].id);
        await chrome.tabs.update(tabs[0].id, { url });
        sendResponse({ success: true, message: `Membuka URL: ${url}`, url });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  // Meneruskan perintah dari Side Panel ke Content Script di Tab Aktif dengan Anti-Looping Protection & Safe Sender
  if (request.action === "EXECUTE_IN_CONTENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        sendResponse({ success: false, error: "Tidak ada tab aktif yang ditemukan." });
        return;
      }

      const activeTab = tabs[0];
      const activeTabId = activeTab.id;
      const tabUrl = activeTab.url || "";

      // 1. Handling Halaman internal Chrome (chrome://, edge://, about:)
      const isInternalPage = /^(chrome|edge|about|chrome-extension):\/\//i.test(tabUrl) || !tabUrl || tabUrl === "about:blank";

      if (isInternalPage) {
        if (request.payload?.type === "SCAN_DOM" || request.payload?.type === "PARSE_DOM") {
          sendResponse({
            success: true,
            data: {
              title: activeTab.title || "Tab Baru",
              url: tabUrl || "chrome://newtab",
              elementsCount: 0,
              reducedDOM: "[NEWTAB_EMPTY_PAGE] Halaman kosong. Gunakan tool navigate_to untuk membuka URL atau mencari sesuatu."
            }
          });
          return;
        }
        if (request.payload?.type === "GET_READABLE_TEXT") {
          sendResponse({
            success: true,
            text: "",
            title: activeTab.title || "Tab Baru",
            url: tabUrl || "chrome://newtab"
          });
          return;
        }
        if (request.payload?.type === "CLEAR_MARKERS" || request.payload?.type === "WAIT_FOR_DOM_STABLE" || request.payload?.type === "UNLOCK_PAGE" || request.payload?.type === "LOCK_PAGE") {
          sendResponse({ success: true, stable: true });
          return;
        }
      }

      // 2. Action-Signature Hash & Circuit Breaker Anti-Looping
      if (request.payload?.type === "EXECUTE_ACTION" || request.payload?.type === "EXECUTE_TOOL") {
        const actData = request.payload.actionData || {};
        const actionName = actData.action || actData.tool || "";

        // Handler jika AI memanggil finish_task: langsung sukses dan hentikan loop
        if (actionName === "finish_task" || actionName === "finish") {
          actionHistoryPerTab.delete(activeTabId);
          persistSWState();
          bgLog("ACTION", "FINISH_TASK", `finish_task dieksekusi: ${actData.message || 'Selesai'}`, actData, activeTabId);
          sendResponse({
            success: true,
            isFinished: true,
            message: actData.message || "Tugas telah diselesaikan sepenuhnya."
          });
          return;
        }

        // Action-Signature Hash
        const actionSignature = `${actionName}:${JSON.stringify(actData)}`;

        if (!actionHistoryPerTab.has(activeTabId)) {
          actionHistoryPerTab.set(activeTabId, []);
        }
        const hist = actionHistoryPerTab.get(activeTabId);
        hist.push(actionSignature);

        if (hist.length > 8) {
          hist.shift();
        }
        persistSWState();

        // Circuit Breaker Cerdas:
        // 1. Hanya terpicu jika aksi 100% IDENTIK diulang >= 4 kali berturut-turut (toleran untuk 1-3x retry normal)
        // 2. Atau pola ping-pong bolak-balik 2 aksi (A-B-A-B-A-B) >= 6 langkah
        const isExcludedAction = actionSignature.includes('"action":"scroll"') ||
                                 actionSignature.includes('"action":"wait"') ||
                                 actionSignature.includes('press_key');

        let isLooping = false;
        if (!isExcludedAction) {
          if (hist.length >= 4) {
            const last4 = hist.slice(-4);
            if (last4.every(s => s === last4[0])) {
              isLooping = true;
            }
          }
          if (!isLooping && hist.length >= 6) {
            const last6 = hist.slice(-6);
            if (last6[0] === last6[2] && last6[2] === last6[4] &&
                last6[1] === last6[3] && last6[3] === last6[5] &&
                last6[0] !== last6[1]) {
              isLooping = true;
            }
          }
        }

        if (isLooping) {
          actionHistoryPerTab.delete(activeTabId);
          bgLog("WARN", "CIRCUIT_BREAKER", `Looping terdeteksi pada tab ${activeTabId}! Mencegah infinite loop.`, { actionSignature, history: hist }, activeTabId);
          sendResponse({
            success: false,
            error: "Looping terdeteksi: AI mencoba mengeksekusi aksi yang sama 4x berturut-turut tanpa perubahan. Mencoba strategi baru.",
            isLoopDetected: true
          });
          return;
        }

        bgLog("ACTION", "EXEC_ACTION", `Mengeksekusi aksi: ${actionName}`, actData, activeTabId);
      }

      // 3. Kirim pesan ke tab aktif menggunakan sendTabMessageSafe
      try {
        const response = await sendTabMessageSafe(activeTabId, request.payload);
        sendResponse({ success: true, data: response });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });

    return true; // Asynchronous sendResponse
  }
});

// Auto-clean visual markers & reset loop history saat user berpindah tab atau tab di-refresh
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!activeInfo?.tabId) return;
  actionHistoryPerTab.delete(activeInfo.tabId);
  chrome.tabs.sendMessage(activeInfo.tabId, { type: "CLEAR_MARKERS" }, () => {
    if (chrome.runtime.lastError) {}
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    actionHistoryPerTab.delete(tabId);
    chrome.tabs.sendMessage(tabId, { type: "CLEAR_MARKERS" }, () => {
      if (chrome.runtime.lastError) {}
    });
  }
});
