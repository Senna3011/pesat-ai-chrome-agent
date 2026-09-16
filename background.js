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
        let url = request.url || "";
        if (url && !/^https?:\/\//i.test(url)) {
          url = "https://" + url;
        }
        await chrome.tabs.update(tabs[0].id, { url });
        sendResponse({ success: true, message: `Membuka URL: ${url}` });
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

