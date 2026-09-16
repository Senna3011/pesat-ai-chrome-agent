// content.js - DOM Reader & Action Executor (Injected into Web Pages)

console.log("[Pesat AI Agent] Content script injected.");

// Listener untuk pesan dari background / side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Pesat AI Agent] Received message:", message);

  if (message.type === "GET_PAGE_INFO") {
    const pageInfo = {
      title: document.title,
      url: window.location.href,
      interactiveElementsCount: {
        buttons: document.querySelectorAll("button").length,
        links: document.querySelectorAll("a").length,
        inputs: document.querySelectorAll("input, textarea, select").length
      }
    };
    sendResponse({ success: true, pageInfo });
    return true;
  }

  if (message.type === "HIGHLIGHT_ELEMENTS") {
    const elements = document.querySelectorAll("button, input, a[href]");
    let count = 0;
    
    elements.forEach((el, index) => {
      // Simpan styling lama sementara
      if (!el.dataset.aiOriginalOutline) {
        el.dataset.aiOriginalOutline = el.style.outline || "";
      }
      
      // Berikan highlight visual border merah / outline khas AI Agent
      el.style.outline = "2px solid #ef4444";
      count++;
    });

    // Reset highlight setelah 3 detik
    setTimeout(() => {
      elements.forEach((el) => {
        el.style.outline = el.dataset.aiOriginalOutline || "";
      });
    }, 3000);

    sendResponse({ success: true, highlightedCount: count });
    return true;
  }

  if (message.type === "EXECUTE_ACTION") {
    // Placeholder untuk eksekusi aksi (click, type, scroll)
    const { action, selector, value } = message;
    const target = document.querySelector(selector);

    if (!target) {
      sendResponse({ success: false, error: `Elemen ${selector} tidak ditemukan.` });
      return true;
    }

    if (action === "click") {
      target.click();
      sendResponse({ success: true, message: `Berhasil mengklik ${selector}` });
    } else if (action === "type") {
      target.value = value || "";
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      sendResponse({ success: true, message: `Berhasil mengisi teks pada ${selector}` });
    } else {
      sendResponse({ success: false, error: `Aksi ${action} belum didukung.` });
    }
    return true;
  }
});
