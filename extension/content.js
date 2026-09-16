// content.js - Smart DOM Scanner, Visual Marker Overlay, & Multi-Action Executor

(() => {
  let markersOverlay = null;
  let activeElementsMap = new Map(); // Map pesat-id -> DOM element

  console.log("[Pesat AI Agent] Smart Content Script loaded.");

  // Helper: Cek apakah elemen terlihat di viewport (tidak tersembunyi/display:none)
  function isElementVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) + 100 &&
      rect.bottom >= -100 &&
      rect.left <= (window.innerWidth || document.documentElement.clientWidth) + 100 &&
      rect.right >= -100
    );
  }

  // Bersihkan penanda visual lama
  function clearVisualMarkers() {
    if (markersOverlay) {
      markersOverlay.remove();
      markersOverlay = null;
    }
    document.querySelectorAll("[data-pesat-id]").forEach(el => {
      el.removeAttribute("data-pesat-id");
      el.style.outline = el.dataset.pesatOldOutline || "";
      delete el.dataset.pesatOldOutline;
    });
    activeElementsMap.clear();
  }

  // Pindai elemen interaktif & buat penanda visual elegan (Reduced DOM)
  function scanInteractiveDOM(showOverlay = true) {
    clearVisualMarkers();

    const selector = [
      "a[href]",
      "button",
      "input",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      "[role='checkbox']",
      "[role='tab']",
      "[tabindex='0']",
      "[contenteditable='true']",
      "summary"
    ].join(", ");

    const candidateElements = Array.from(document.querySelectorAll(selector));
    const visibleElements = candidateElements.filter(isElementVisible);

    if (showOverlay && visibleElements.length > 0) {
      markersOverlay = document.createElement("div");
      markersOverlay.id = "pesat-markers-overlay";
      markersOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: ${Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)}px;
        pointer-events: none;
        z-index: 2147483640;
        overflow: hidden;
      `;
      document.body.appendChild(markersOverlay);
    }

    const elementsList = [];
    let idCounter = 1;

    for (const el of visibleElements) {
      // Batasi maksimal 60 elemen terpenting agar hemat token AI
      if (idCounter > 60) break;

      const elementId = idCounter++;
      el.setAttribute("data-pesat-id", elementId);
      activeElementsMap.set(elementId, el);

      const rect = el.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      // Buat badge overlay visual
      if (showOverlay && markersOverlay) {
        const badge = document.createElement("div");
        badge.textContent = elementId;
        badge.style.cssText = `
          position: absolute;
          top: ${rect.top + scrollY - 8}px;
          left: ${rect.left + scrollX - 8}px;
          background: #2563eb;
          color: #ffffff;
          font-size: 11px;
          font-weight: bold;
          font-family: monospace;
          padding: 2px 6px;
          border-radius: 4px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
          border: 1px solid #60a5fa;
          z-index: 2147483647;
          pointer-events: none;
          line-height: 1;
        `;
        markersOverlay.appendChild(badge);
      }

      // Ringkas metadata elemen untuk AI (Reduced DOM)
      const tagName = el.tagName.toLowerCase();
      const type = el.getAttribute("type") || "";
      const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").substring(0, 50);
      const placeholder = el.getAttribute("placeholder") || "";
      const ariaLabel = el.getAttribute("aria-label") || "";
      const name = el.getAttribute("name") || "";
      const value = el instanceof HTMLInputElement ? el.value : "";

      let desc = `<${tagName}`;
      if (type) desc += ` type="${type}"`;
      if (name) desc += ` name="${name}"`;
      if (placeholder) desc += ` placeholder="${placeholder}"`;
      if (ariaLabel) desc += ` aria-label="${ariaLabel}"`;
      if (value) desc += ` value="${value}"`;
      desc += ">";
      if (text) desc += ` "${text}"`;

      elementsList.push(`[${elementId}] ${desc}`);
    }

    return {
      title: document.title,
      url: window.location.href,
      elementsCount: visibleElements.length,
      reducedDOM: elementsList.join("\n")
    };
  }

  // Eksekusi aksi fisik pada elemen web
  async function executeAction(actionData) {
    const { action, elementId, value, scrollDirection } = actionData;

    // Aksi Scroll
    if (action === "scroll") {
      const distance = scrollDirection === "up" ? -500 : 500;
      window.scrollBy({ top: distance, behavior: "smooth" });
      await new Promise(r => setTimeout(r, 600));
      return { success: true, message: `Berhasil scroll ${scrollDirection || 'down'}` };
    }

    // Aksi Navigasi URL
    if (action === "navigate") {
      if (value && value.startsWith("http")) {
        window.location.href = value;
        return { success: true, message: `Membuka URL: ${value}` };
      }
      return { success: false, error: "URL tidak valid." };
    }

    // Aksi pada Elemen Terpilih
    const targetEl = activeElementsMap.get(Number(elementId)) || document.querySelector(`[data-pesat-id="${elementId}"]`);

    if (!targetEl) {
      return { success: false, error: `Elemen [${elementId}] tidak ditemukan pada halaman saat ini.` };
    }

    // Efek visual glow pada elemen target
    const oldOutline = targetEl.style.outline;
    targetEl.style.outline = "3px solid #10b981";
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise(r => setTimeout(r, 300));

    try {
      if (action === "click") {
        targetEl.focus();
        targetEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        targetEl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        targetEl.click();
        setTimeout(() => { targetEl.style.outline = oldOutline; }, 1000);
        return { success: true, message: `Berhasil mengklik elemen [${elementId}]` };
      }

      if (action === "type") {
        targetEl.focus();
        if (targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement) {
          targetEl.value = value || "";
          targetEl.dispatchEvent(new Event("input", { bubbles: true }));
          targetEl.dispatchEvent(new Event("change", { bubbles: true }));
          
          if (actionData.pressEnter) {
            targetEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
            targetEl.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", keyCode: 13, bubbles: true }));
            targetEl.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, bubbles: true }));
            // Submit form jika ada
            if (targetEl.form) {
              targetEl.form.dispatchEvent(new Event("submit", { bubbles: true }));
            }
          }
        }
        setTimeout(() => { targetEl.style.outline = oldOutline; }, 1000);
        return { success: true, message: `Berhasil mengetik "${value}" pada elemen [${elementId}]` };
      }

      if (action === "extract") {
        const text = (targetEl.innerText || targetEl.textContent || "").trim();
        setTimeout(() => { targetEl.style.outline = oldOutline; }, 1000);
        return { success: true, extractedText: text };
      }

      return { success: false, error: `Aksi "${action}" tidak dikenal.` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Ekstrak Konten Utama Halaman (untuk fitur Rangkum Halaman)
  function extractMainContent() {
    const mainEl = document.querySelector("main, article, #content, .content, body");
    if (!mainEl) return document.body.innerText.substring(0, 3000);
    return mainEl.innerText.replace(/\s+/g, " ").substring(0, 4000);
  }

  // Listener Komunikasi Pesan dari Extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SCAN_DOM") {
      const data = scanInteractiveDOM(request.showOverlay !== false);
      sendResponse({ success: true, data });
      return true;
    }

    if (request.type === "CLEAR_MARKERS") {
      clearVisualMarkers();
      sendResponse({ success: true });
      return true;
    }

    if (request.type === "EXECUTE_ACTION") {
      executeAction(request.actionData).then(result => {
        sendResponse(result);
      });
      return true;
    }

    if (request.type === "EXTRACT_PAGE_CONTENT") {
      const content = extractMainContent();
      sendResponse({
        success: true,
        title: document.title,
        url: window.location.href,
        content
      });
      return true;
    }
  });
})();
