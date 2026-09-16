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

  // Meneruskan perintah dari Side Panel ke Content Script di Tab Aktif
  if (request.action === "EXECUTE_IN_CONTENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        sendResponse({ success: false, error: "Tidak ada tab aktif yang ditemukan." });
        return;
      }

      const activeTabId = tabs[0].id;
      
      try {
        // Pastikan content script sudah di-inject
        await chrome.scripting.executeScript({
          target: { tabId: activeTabId },
          files: ["content.js"]
        });

        // Kirim pesan ke content script
        chrome.tabs.sendMessage(activeTabId, request.payload, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true, data: response });
          }
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });

    return true; // Menandakan respon async
  }
});
