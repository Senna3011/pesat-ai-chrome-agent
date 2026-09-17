// background.js - Service Worker for AI Browser Agent

// Buka side panel otomatis ketika ikon ekstensi di-klik di toolbar
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting panel behavior:", error));

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting panel behavior:", error));

  console.log("Pesat AI Browser Agent installed successfully!");
});

// Listener komunikasi pesan dari Side Panel atau Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PING") {
    sendResponse({ status: "OK", message: "Background service worker active" });
    return true;
  }

  // Navigasi URL tab aktif secara langsung via Chrome Tabs API (aman untuk chrome://newtab dll)
  if (request.action === "NAVIGATE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        sendResponse({ success: false, error: "Tidak ada tab aktif yang ditemukan." });
        return;
      }
      try {
        let rawUrl = (request.url || "").trim();
        if (!rawUrl || rawUrl === "undefined" || rawUrl === "null") {
          sendResponse({ success: false, error: "URL tujuan navigasi kosong atau tidak valid." });
          return;
        }

        let url = rawUrl;
        if (!/^https?:\/\//i.test(url)) {
          if (url.includes(".") || url.startsWith("localhost")) {
            url = "https://" + url;
          } else {
            // Fallback ke Google Search jika bukan domain yang valid
            url = "https://www.google.com/search?q=" + encodeURIComponent(url);
          }
        }

        await chrome.tabs.update(tabs[0].id, { url });
        sendResponse({ success: true, message: `Membuka URL: ${url}`, url });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  // Meneruskan perintah dari Side Panel ke Content Script di Tab Aktif
  if (request.action === "EXECUTE_IN_CONTENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        sendResponse({ success: false, error: "Tidak ada tab aktif yang ditemukan." });
        return;
      }

      const activeTab = tabs[0];
      const activeTabId = activeTab.id;
      const tabUrl = activeTab.url || "";

      // Halaman internal Chrome (chrome://, edge://, about:) tidak bisa diinjeksi content script
      const isInternalPage = /^(chrome|edge|about|chrome-extension):\/\//i.test(tabUrl);

      if (isInternalPage) {
        if (request.payload?.type === "SCAN_DOM") {
          sendResponse({
            success: true,
            data: {
              title: activeTab.title || "Tab Baru",
              url: tabUrl,
              elementsCount: 0,
              reducedDOM: "(Halaman sistem browser baru dibuka. Belum ada website yang dimuat. Gunakan instruksi buka URL atau pencarian web)."
            }
          });
          return;
        }
        if (request.payload?.type === "CLEAR_MARKERS" || request.payload?.type === "WAIT_FOR_DOM_STABLE") {
          sendResponse({ success: true, stable: true });
          return;
        }
      }

      const sendMessageToTab = () => {
        chrome.tabs.sendMessage(activeTabId, request.payload, (response) => {
          if (chrome.runtime.lastError) {
            // Jika content script belum ada, inject dan kirim ulang
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

    return true; // Menandakan respon async
  }
});

// Auto-clean visual markers saat user berpindah tab atau tab di-refresh
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!activeInfo?.tabId) return;
  chrome.tabs.sendMessage(activeInfo.tabId, { type: "CLEAR_MARKERS" }, () => {
    if (chrome.runtime.lastError) {}
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.tabs.sendMessage(tabId, { type: "CLEAR_MARKERS" }, () => {
      if (chrome.runtime.lastError) {}
    });
  }
});
