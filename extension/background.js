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
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_READABLE_TEXT" }, (response) => {
      if (chrome.runtime.lastError) {
        // Coba inject content.js jika belum dimuat
        chrome.scripting
          .executeScript({
            target: { tabId },
            files: ["content.js"]
          })
          .then(() => {
            chrome.tabs.sendMessage(tabId, { type: "GET_READABLE_TEXT" }, (retryRes) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, text: "", error: chrome.runtime.lastError.message });
              } else {
                resolve(retryRes || { success: false, text: "" });
              }
            });
          })
          .catch((err) => resolve({ success: false, text: "", error: err.message }));
      } else {
        resolve(response || { success: false, text: "" });
      }
    });
  });
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
  if (request.action === "PING") {
    sendResponse({ status: "OK", message: "Background service worker active" });
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

  // Reset riwayat loop saat memulai sesi obrolan/perintah baru
  if (request.action === "RESET_LOOP_TRACKER") {
    actionHistoryPerTab.clear();
    sendResponse({ success: true });
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

  // Meneruskan perintah dari Side Panel ke Content Script di Tab Aktif dengan Anti-Looping Protection
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

        if (hist.length > 3) {
          hist.shift();
        }

        // Circuit Breaker: jika aksi 100% identik dipanggil 2-3x berturut-turut (kecuali scroll)
        const isLooping = (hist.length >= 2 && hist[hist.length - 1] === hist[hist.length - 2] && !actionSignature.includes('"action":"scroll"')) ||
                          (hist.length === 3 && hist[0] === hist[1] && hist[1] === hist[2] && !actionSignature.includes('"action":"scroll"'));

        if (isLooping) {
          actionHistoryPerTab.delete(activeTabId);
          bgLog("WARN", "CIRCUIT_BREAKER", `Looping terdeteksi pada tab ${activeTabId}! Mencegah infinite loop.`, { actionSignature, history: hist }, activeTabId);
          sendResponse({
            success: false,
            error: "Looping terdeteksi: AI mencoba mengeksekusi aksi yang sama berulang kali. Menghentikan proses secara aman.",
            isLoopDetected: true
          });
          return;
        }

        bgLog("ACTION", "EXEC_ACTION", `Mengeksekusi aksi: ${actionName}`, actData, activeTabId);
      }

      // 3. Kirim pesan ke tab aktif
      const sendMessageToTab = () => {
        chrome.tabs.sendMessage(activeTabId, request.payload, (response) => {
          if (chrome.runtime.lastError) {
            chrome.scripting.executeScript({
              target: { tabId: activeTabId },
              files: ["content.js"]
            }).then(() => {
              chrome.tabs.sendMessage(activeTabId, request.payload, (retryRes) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  sendResponse({ success: true, data: retryRes });
                }
              });
            }).catch((err) => {
              sendResponse({ success: false, error: err.message });
            });
          } else {
            sendResponse({ success: true, data: response });
          }
        });
      };

      sendMessageToTab();
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
