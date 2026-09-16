// content.js - Nanobrowser-grade Colored Bounding Box Scanner & Multi-Action Executor

(() => {
  let markersOverlay = null;
  let activeElementsMap = new Map();

  console.log("[Pesat AI Agent] Visual DOM Scanner initialized.");

  // Helper: Cek visibilitas elemen di layar
  function isElementVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) < 0.1) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return (
      rect.width > 3 &&
      rect.height > 3 &&
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) + 50 &&
      rect.bottom >= -50 &&
      rect.left <= (window.innerWidth || document.documentElement.clientWidth) + 50 &&
      rect.right >= -50
    );
  }

  // Tentukan warna tema berdasarkan tipe elemen (mirip Nanobrowser)
  function getElementTheme(el) {
    const tagName = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();
    const role = (el.getAttribute("role") || "").toLowerCase();

    if (tagName === "input" || tagName === "textarea") {
      return { border: "#2563eb", bg: "#1d4ed8", name: "input" }; // Blue
    }
    if (tagName === "button" || type === "submit" || role === "button") {
      return { border: "#ef4444", bg: "#b91c1c", name: "button" }; // Red
    }
    if (tagName === "a" || role === "link") {
      return { border: "#10b981", bg: "#047857", name: "link" }; // Green
    }
    if (tagName === "select" || role === "combobox" || role === "tab") {
      return { border: "#f59e0b", bg: "#b45309", name: "control" }; // Amber
    }
    return { border: "#8b5cf6", bg: "#6d28d9", name: "interactive" }; // Purple
  }

  // Bersihkan semua overlay kotak visual
  function clearVisualMarkers() {
    if (markersOverlay) {
      markersOverlay.remove();
      markersOverlay = null;
    }
    document.querySelectorAll("[data-pesat-id]").forEach(el => {
      el.removeAttribute("data-pesat-id");
    });
    activeElementsMap.clear();
  }

  // Pindai elemen interaktif & gambar Colored Bounding Boxes ala Nanobrowser
  function scanInteractiveDOM(showOverlay = true) {
    clearVisualMarkers();

    const selector = [
      "a[href]",
      "button",
      "input:not([type='hidden'])",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      "[role='tab']",
      "[role='checkbox']",
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
      if (idCounter > 70) break; // Batas wajar untuk efisiensi token

      const elementId = idCounter++;
      el.setAttribute("data-pesat-id", elementId);
      activeElementsMap.set(elementId, el);

      const rect = el.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      const theme = getElementTheme(el);

      // Gambar Colored Bounding Box & Number Badge
      if (showOverlay && markersOverlay) {
        const box = document.createElement("div");
        box.style.cssText = `
          position: absolute;
          top: ${rect.top + scrollY}px;
          left: ${rect.left + scrollX}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          border: 2px solid ${theme.border};
          border-radius: 4px;
          pointer-events: none;
          box-sizing: border-box;
          z-index: 2147483645;
        `;

        const badge = document.createElement("span");
        badge.textContent = elementId;
        badge.style.cssText = `
          position: absolute;
          top: -10px;
          left: -4px;
          background: ${theme.bg};
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          font-family: ui-monospace, SFMono-Regular, monospace;
          padding: 1px 5px;
          border-radius: 3px;
          border: 1px solid rgba(255,255,255,0.4);
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          line-height: 1.2;
        `;
        box.appendChild(badge);
        markersOverlay.appendChild(box);
      }

      // Format Reduced DOM untuk AI
      const tagName = el.tagName.toLowerCase();
      const type = el.getAttribute("type") || "";
      const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").substring(0, 60);
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

    if (action === "scroll") {
      const distance = scrollDirection === "up" ? -500 : 500;
      window.scrollBy({ top: distance, behavior: "smooth" });
      await new Promise(r => setTimeout(r, 600));
      return { success: true, message: `Berhasil scroll ${scrollDirection || 'down'}` };
    }

    if (action === "navigate") {
      if (value && value.startsWith("http")) {
        window.location.href = value;
        return { success: true, message: `Membuka URL: ${value}` };
      }
      return { success: false, error: "URL tidak valid." };
    }

    const targetEl = activeElementsMap.get(Number(elementId)) || document.querySelector(`[data-pesat-id="${elementId}"]`);

    if (!targetEl) {
      return { success: false, error: `Elemen [${elementId}] tidak ditemukan.` };
    }

    // Efek visual glow
    const oldOutline = targetEl.style.outline;
    targetEl.style.outline = "3px solid #10b981";
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise(r => setTimeout(r, 350));

    try {
      if (action === "click") {
        targetEl.focus();
        targetEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        targetEl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        targetEl.click();
        setTimeout(() => { targetEl.style.outline = oldOutline; }, 1000);
        return { success: true, message: `Klik pada elemen [${elementId}] berhasil.` };
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
            if (targetEl.form) targetEl.form.dispatchEvent(new Event("submit", { bubbles: true }));
          }
        }
        setTimeout(() => { targetEl.style.outline = oldOutline; }, 1000);
        return { success: true, message: `Mengetik "${value}" pada elemen [${elementId}] berhasil.` };
      }

      return { success: false, error: `Aksi ${action} tidak didukung.` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Listener Komunikasi
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
      executeAction(request.actionData).then(result => sendResponse(result));
      return true;
    }
  });
})();
