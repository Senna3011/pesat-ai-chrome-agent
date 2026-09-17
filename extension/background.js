// background.js - Service Worker & ReAct Message Orchestrator (MV3 Compliant with Anti-Looping & Human-in-the-Loop)

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

  console.log("[Pesat AI Agent] Background Service Worker installed successfully.");
});

// Listener komunikasi pesan dari Side Panel atau Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PING") {
    sendResponse({ status: "OK", message: "Background service worker active" });
    return true;
  }

  // Reset riwayat loop saat memulai sesi obrolan/perintah baru
  if (request.action === "RESET_LOOP_TRACKER") {
    actionHistoryPerTab.clear();
    sendResponse({ success: true });
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
        if (request.payload?.type === "CLEAR_MARKERS" || request.payload?.type === "WAIT_FOR_DOM_STABLE") {
          sendResponse({ success: true, stable: true });
          return;
        }
      }

      // 2. Anti-Looping: Cek apakah aksi dan target yang sama dieksekusi 3x berturut-turut
      if (request.payload?.type === "EXECUTE_ACTION" || request.payload?.type === "EXECUTE_TOOL") {
        const actData = request.payload.actionData || {};
        const actKey = `${actData.action || actData.tool || ''}:${actData.elementId || actData.selector || ''}:${actData.value || ''}`;

        if (!actionHistoryPerTab.has(activeTabId)) {
          actionHistoryPerTab.set(activeTabId, []);
        }
        const hist = actionHistoryPerTab.get(activeTabId);
        hist.push(actKey);

        if (hist.length > 3) {
          hist.shift();
        }

        if (hist.length === 3 && hist[0] === hist[1] && hist[1] === hist[2] && hist[0] !== "scroll::") {
          actionHistoryPerTab.delete(activeTabId);
          sendResponse({
            success: false,
            error: "Terdeteksi aksi berulang (looping), penghentian otomatis dilakukan untuk keselamatan.",
            isLoopDetected: true
          });
          return;
        }
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
