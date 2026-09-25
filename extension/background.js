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

// Buka side panel otomatis ketika ikon ekstensi di-klik di toolbar
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("[Pesat SW] Error setting panel behavior:", error));

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("[Pesat SW] Error setting panel behavior:", error));

  bgLog("INFO", "SW_INSTALLED", "Background Service Worker berhasil diinstal & aktif.");
  console.log("[Pesat AI Agent] Background Service Worker installed successfully.");
});

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
      // Delay singkat memastikan content script siap mendengarkan listener
      await new Promise((r) => setTimeout(r, 120));
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

  // Ambil teks murni artikel (Readable Text) secara langsung dari tab aktif
  if (request.action === "GET_READABLE_TEXT" || request.type === "GET_READABLE_TEXT") {
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

  // Reset riwayat loop & token accumulator saat memulai sesi obrolan/perintah baru
  if (request.action === "RESET_LOOP_TRACKER" || request.type === "RESET_LOOP_TRACKER") {
    actionHistoryPerTab.clear();
    taskTokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    sendResponse({ success: true, taskTokenUsage });
    return true;
  }

  // Token Usage Tracking Handlers
  if (request.action === "RECORD_TOKEN_USAGE" || request.type === "RECORD_TOKEN_USAGE") {
    const usage = request.usage || {};
    taskTokenUsage.prompt_tokens += (Number(usage.prompt_tokens) || 0);
    taskTokenUsage.completion_tokens += (Number(usage.completion_tokens) || 0);
    taskTokenUsage.total_tokens += (Number(usage.total_tokens) || ((Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0)));

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

        // 1. Log telemetry via logger.js / bgLog
        bgLog("WARN", "USER_BUG_REPORT", `[BUG REPORT] ${reportPayload.userDescription}`, reportPayload, activeTabId);

        // 2. Simpan backup lokal di chrome.storage.local
        chrome.storage.local.get(["pesat_bug_reports"], (res) => {
          const reports = res.pesat_bug_reports || [];
          reports.unshift({ ...reportPayload, timestamp: Date.now() });
          chrome.storage.local.set({ pesat_bug_reports: reports.slice(0, 50) });
        });

        // 3. Kirim ke remote endpoint jika tersedia
        try {
          const remoteEndpoint = "https://pesat-ai-chrome-agent.senna-947.workers.dev/api/chat";
          await fetch(remoteEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "SUBMIT_BUG_REPORT",
              isBugReport: true,
              ...reportPayload
            })
          }).catch(() => {});
        } catch (_) {}

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
    chrome.storage.local.get(["googleAuthToken", "googleUserEmail"], (res) => {
      sendResponse({ connected: Boolean(res.googleAuthToken), email: res.googleUserEmail || "" });
    });
    return true;
  }

  if (request.action === "GOOGLE_DISCONNECT") {
    chrome.storage.local.remove(["googleAuthToken", "googleUserEmail"], () => {
      sendResponse({ success: true });
    });
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
