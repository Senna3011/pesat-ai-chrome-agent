// content.js - Nanobrowser & Agent-Browser Grade Semantic AXTree Scanner & Robust Action Engine

(() => {
  let markersOverlay = null;
  let activeElementsMap = new Map();

  console.log("[Pesat AI Agent] Semantic AXTree DOM Engine initialized (v4.0).");

  // Helper: Cek apakah elemen ada di viewport dan terlihat
  function isElementVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      parseFloat(style.opacity) < 0.1 ||
      style.pointerEvents === "none"
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 3 || rect.height < 3) return false;

    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;

    // Viewport checking dengan margin toleransi
    return rect.top <= vh + 100 && rect.bottom >= -100 && rect.left <= vw + 100 && rect.right >= -100;
  }

  // Helper: Deteksi Occlusion (apakah elemen tertutup modal, popup, atau banner cookie)
  function checkOcclusion(el) {
    try {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Cek titik tengah elemen
      const topEl = document.elementFromPoint(cx, cy);
      if (!topEl) return { covered: false };

      if (el === topEl || el.contains(topEl) || topEl.contains(el)) {
        return { covered: false };
      }

      // Format nama elemen yang menutupi
      const coverId = topEl.id ? `#${topEl.id}` : "";
      const coverClass = topEl.className && typeof topEl.className === "string" ? `.${topEl.className.trim().split(/\s+/)[0]}` : "";
      const coverTag = topEl.tagName.toLowerCase();
      return {
        covered: true,
        coveredBy: `<${coverTag}${coverId}${coverClass}>`
      };
    } catch {
      return { covered: false };
    }
  }

  // Helper: Dapatkan Role Aksesibilitas Semantik (AXTree Role)
  function getSemanticRole(el) {
    const role = el.getAttribute("role");
    if (role) return role.toLowerCase();

    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();

    if (tag === "button" || (tag === "input" && (type === "button" || type === "submit" || type === "reset"))) return "button";
    if (tag === "a" && el.hasAttribute("href")) return "link";
    if (tag === "input") {
      if (type === "search") return "searchbox";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "email" || type === "password" || type === "tel" || type === "url" || type === "text" || !type) return "textbox";
      return type;
    }
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "summary") return "button";
    if (el.isContentEditable) return "textbox";

    return tag;
  }

  // Helper: Dapatkan Accessible Name / Label Elemen
  function getAccessibleName(el) {
    // 1. aria-label
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    // 2. aria-labelledby
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const labelEl = document.getElementById(labelledby);
      if (labelEl && labelEl.textContent.trim()) return labelEl.textContent.trim();
    }

    // 3. Label tag jika ada (untuk input)
    if (el.id) {
      const labelFor = document.querySelector(`label[for="${el.id}"]`);
      if (labelFor && labelFor.textContent.trim()) return labelFor.textContent.trim();
    }
    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.textContent.trim()) {
      return parentLabel.textContent.replace(el.textContent || "", "").trim();
    }

    // 4. Placeholder / Title / Alt
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) return placeholder.trim();

    const title = el.getAttribute("title");
    if (title && title.trim()) return title.trim();

    const alt = el.getAttribute("alt");
    if (alt && alt.trim()) return alt.trim();

    // 5. Visible InnerText / TextContent
    const innerText = (el.innerText || el.textContent || "").trim();
    if (innerText) return innerText.replace(/\s+/g, " ").slice(0, 120);

    return "";
  }

  // Tentukan warna tema bounding box
  function getRoleIcon(role) {
    if (role === "textbox" || role === "searchbox") return "📝";
    if (role === "button") return "🔘";
    if (role === "link") return "🔗";
    if (role === "combobox" || role === "select" || role === "tab" || role === "menuitem") return "📋";
    if (role === "checkbox" || role === "radio") return "☑️";
    return "⚡";
  }

  function getElementTheme(role) {
    if (role === "textbox" || role === "searchbox") {
      return { border: "#2563eb", bg: "#1d4ed8", name: "input" }; // Blue
    }
    if (role === "button") {
      return { border: "#ef4444", bg: "#b91c1c", name: "button" }; // Red
    }
    if (role === "link") {
      return { border: "#10b981", bg: "#047857", name: "link" }; // Green
    }
    if (role === "combobox" || role === "select" || role === "tab" || role === "menuitem") {
      return { border: "#f59e0b", bg: "#b45309", name: "control" }; // Amber
    }
    return { border: "#8b5cf6", bg: "#6d28d9", name: "interactive" }; // Purple
  }

  // Render Petunjuk / Legenda Marker Ramah Pengguna
  function renderFloatingLegend() {
    const existing = document.getElementById("pesat-markers-legend");
    if (existing) existing.remove();

    const legend = document.createElement("div");
    legend.id = "pesat-markers-legend";
    legend.style.cssText = `
      position: fixed;
      bottom: 18px;
      right: 18px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 10px 14px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 290px;
      color: #f8fafc;
      pointer-events: auto;
      user-select: none;
    `;

    legend.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:12px; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:5px;">
          ⚡ Petunjuk Marker AI (#ID)
        </span>
        <button id="pesat-btn-close-legend" style="background:none; border:none; color:#94a3b8; font-size:14px; cursor:pointer; padding:0 4px;" title="Tutup">✕</button>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:11px; color:#cbd5e1;">
        <div style="display:flex; align-items:center; gap:5px;">
          <span style="width:10px; height:10px; border-radius:2px; background:#1d4ed8; display:inline-block;"></span>
          <span>📝 Input / Form</span>
        </div>
        <div style="display:flex; align-items:center; gap:5px;">
          <span style="width:10px; height:10px; border-radius:2px; background:#b91c1c; display:inline-block;"></span>
          <span>🔘 Tombol</span>
        </div>
        <div style="display:flex; align-items:center; gap:5px;">
          <span style="width:10px; height:10px; border-radius:2px; background:#047857; display:inline-block;"></span>
          <span>🔗 Menu / Link</span>
        </div>
        <div style="display:flex; align-items:center; gap:5px;">
          <span style="width:10px; height:10px; border-radius:2px; background:#b45309; display:inline-block;"></span>
          <span>📋 Dropdown</span>
        </div>
      </div>
      <div style="font-size:10px; color:#94a3b8; margin-top:8px; border-top:1px solid #1e293b; padding-top:6px; line-height:1.3;">
        💡 Nomor (#1, #2...) adalah ID tombol/input yang dapat diperintahkan ke AI.
      </div>
    `;

    document.body.appendChild(legend);

    document.getElementById("pesat-btn-close-legend")?.addEventListener("click", () => {
      legend.remove();
    });
  }

  // Bersihkan semua visual marker overlay & legend
  function clearVisualMarkers() {
    if (markersOverlay) {
      markersOverlay.remove();
      markersOverlay = null;
    }
    const legend = document.getElementById("pesat-markers-legend");
    if (legend) legend.remove();

    document.querySelectorAll("[data-pesat-id]").forEach((el) => {
      el.removeAttribute("data-pesat-id");
    });
    activeElementsMap.clear();
  }

  // Pindai elemen interaktif & bangun Semantic AXTree Snapshot
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
      "[role='radio']",
      "[role='combobox']",
      "[role='searchbox']",
      "[role='menuitem']",
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
      renderFloatingLegend();
    }

    const elementsList = [];
    let idCounter = 1;

    for (const el of visibleElements) {
      if (idCounter > 75) break; // Batas token hemat

      const elementId = idCounter++;
      el.setAttribute("data-pesat-id", elementId);
      activeElementsMap.set(elementId, el);

      const rect = el.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      const role = getSemanticRole(el);
      const label = getAccessibleName(el);
      const theme = getElementTheme(role);
      const icon = getRoleIcon(role);
      const occlusion = checkOcclusion(el);

      // Gambar Colored Bounding Box & User-Friendly Badge
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
        badge.textContent = `#${elementId} ${icon}`;
        badge.title = `Target #${elementId}: ${label || role}`;
        badge.style.cssText = `
          position: absolute;
          top: -12px;
          left: -4px;
          background: ${theme.bg};
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.4);
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          line-height: 1.2;
          display: inline-flex;
          align-items: center;
          gap: 2px;
        `;
        box.appendChild(badge);
        markersOverlay.appendChild(box);
      }

      // States
      const stateFlags = [];
      if (el.disabled) stateFlags.push("disabled");
      if (el.readOnly) stateFlags.push("readonly");
      if (el.required) stateFlags.push("required");
      if (el.checked) stateFlags.push("checked");
      if (el.getAttribute("aria-expanded") === "true") stateFlags.push("expanded");
      if (occlusion.covered) stateFlags.push(`covered_by=${occlusion.coveredBy}`);

      let val = "";
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el instanceof HTMLInputElement && el.type === "password") {
          val = el.value ? ' value="[PROTECTED]"' : "";
        } else {
          val = el.value ? ` value="${el.value.slice(0, 50)}"` : "";
        }
      }

      const placeholder = el.getAttribute("placeholder") ? ` placeholder="${el.getAttribute("placeholder")}"` : "";
      const statesStr = stateFlags.length > 0 ? ` [${stateFlags.join(", ")}]` : "";

      // Format Semantic AXTree Node (mirip agent-browser / Playwright semantic tree)
      elementsList.push(`[@e${elementId}] <${role}${placeholder}${val}${statesStr}> "${label}"`);
    }

    const pageReadableText = extractReadablePageText();

    return {
      title: document.title,
      url: window.location.href,
      elementsCount: visibleElements.length,
      reducedDOM: elementsList.join("\n"),
      pageContent: pageReadableText
    };
  }

  // Ekstraksi teks konten utama halaman
  function extractReadablePageText() {
    try {
      const mainContainer = document.querySelector("main, article, [role='main'], #main-content, .dashboard, .kanban-board, .content, body");
      if (!mainContainer) return "";

      const clone = mainContainer.cloneNode(true);
      clone.querySelectorAll("script, style, noscript, svg, #pesat-markers-overlay").forEach((el) => el.remove());

      const rawText = clone.innerText || clone.textContent || "";
      return rawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join("\n")
        .substring(0, 4500);
    } catch {
      return "";
    }
  }

  // ─────────────────────────────────────────────────────
  // AUTO-WAITING & TARGETED WAIT
  // ─────────────────────────────────────────────────────
  function waitForDOMStable(maxWaitMs = 5000, stableWindowMs = 600) {
    return new Promise((resolve) => {
      let stableTimer = null;
      const deadline = Date.now() + maxWaitMs;

      const markStable = () => {
        stableTimer = setTimeout(() => {
          observer.disconnect();
          resolve({ stable: true });
        }, stableWindowMs);
      };

      const observer = new MutationObserver(() => {
        if (stableTimer) clearTimeout(stableTimer);
        if (Date.now() >= deadline) {
          observer.disconnect();
          resolve({ stable: false, timedOut: true });
          return;
        }
        markStable();
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });

      setTimeout(() => {
        observer.disconnect();
        resolve({ stable: false, timedOut: true });
      }, maxWaitMs);

      markStable();
    });
  }

  // Targeted Wait: Tunggu selector tertentu muncul
  function waitForSelector(selector, timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve({ success: true });
      }
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve({ success: true });
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve({ success: false, timedOut: true });
      }, timeoutMs);
    });
  }

  // ─────────────────────────────────────────────────────
  // FUZZY FALLBACK: Cari elemen jika ID meleset
  // ─────────────────────────────────────────────────────
  function findElementByFuzzy(hintText, action) {
    if (!hintText) return null;
    const q = String(hintText).toLowerCase().replace(/^@e/, "").trim();

    const pool = action === "click"
      ? Array.from(document.querySelectorAll("button, a[href], [role='button'], input[type='submit'], input[type='button'], summary"))
      : Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']"));

    const scored = pool
      .filter(isElementVisible)
      .map((el) => {
        const candidates = [
          getAccessibleName(el),
          el.innerText || "",
          el.getAttribute("placeholder") || "",
          el.getAttribute("name") || "",
          el.getAttribute("value") || ""
        ].map((s) => s.toLowerCase().trim());

        const score = candidates.reduce((acc, c) => {
          if (c === q) return acc + 100;
          if (c.includes(q)) return acc + 50;
          if (q.includes(c) && c.length > 2) return acc + 25;
          return acc;
        }, 0);

        return { el, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.length > 0 ? scored[0].el : null;
  }

  // ─────────────────────────────────────────────────────
  // REACT / VUE COMPATIBLE VALUE SETTER
  // ─────────────────────────────────────────────────────
  function setNativeInputValue(el, value) {
    if (el instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) {
        setter.call(el, value);
      } else {
        el.value = value;
      }
    } else if (el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) {
        setter.call(el, value);
      } else {
        el.value = value;
      }
    } else if (el.isContentEditable) {
      el.innerText = value;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ─────────────────────────────────────────────────────
  // SINGLE ACTION EXECUTOR
  // ─────────────────────────────────────────────────────
  async function executeSingleAction(actionData) {
    const { action, value, pressEnter, scrollDirection } = actionData;
    let cleanId = String(actionData.elementId || "").replace(/[@#\[\]eE\s]/g, "").trim();

    if (action === "scroll") {
      const distance = scrollDirection === "up" ? -500 : 500;
      window.scrollBy({ top: distance, behavior: "smooth" });
      await new Promise((r) => setTimeout(r, 500));
      return { success: true, message: `Berhasil scroll ${scrollDirection || "down"}` };
    }

    if (action === "navigate") {
      if (value && value.startsWith("http")) {
        window.location.href = value;
        return { success: true, message: `Membuka URL: ${value}` };
      }
      return { success: false, error: "URL tidak valid. Format wajib: https://" };
    }

    if (action === "wait") {
      const waitMs = parseInt(value, 10) || 1000;
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 5000)));
      return { success: true, message: `Menunggu ${waitMs}ms` };
    }

    // Cari elemen berdasarkan ID angka atau ref @eN
    let targetEl = activeElementsMap.get(Number(cleanId)) || document.querySelector(`[data-pesat-id="${cleanId}"]`);

    let usedFuzzy = false;
    if (!targetEl) {
      const hint = value || String(cleanId);
      targetEl = findElementByFuzzy(hint, action);
      if (targetEl) {
        usedFuzzy = true;
      }
    }

    if (!targetEl) {
      return {
        success: false,
        error: `Elemen [@e${cleanId || "?"}] tidak ditemukan di layar.`,
        suggestion: "scroll"
      };
    }

    // Periksa Occlusion (apakah elemen tertutup modal / banner)
    const occlusion = checkOcclusion(targetEl);
    if (occlusion.covered) {
      console.warn(`[Pesat] Target tertutup oleh ${occlusion.coveredBy}`);
    }

    // Efek visual glow
    const oldOutline = targetEl.style.outline;
    const glowColor = usedFuzzy ? "#f59e0b" : "#10b981";
    targetEl.style.outline = `3px solid ${glowColor}`;
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise((r) => setTimeout(r, 250));

    const fuzzyNote = usedFuzzy ? " (fuzzy match)" : "";
    const coveredNote = occlusion.covered ? ` [Peringatan: tertutup ${occlusion.coveredBy}]` : "";

    try {
      if (action === "click") {
        targetEl.focus();

        // Rantai event lengkap pointer + mouse untuk framework modern
        const eventInit = { bubbles: true, cancelable: true, view: window };
        targetEl.dispatchEvent(new PointerEvent("pointerdown", eventInit));
        targetEl.dispatchEvent(new MouseEvent("mousedown", eventInit));
        targetEl.dispatchEvent(new PointerEvent("pointerup", eventInit));
        targetEl.dispatchEvent(new MouseEvent("mouseup", eventInit));
        targetEl.click();

        setTimeout(() => { targetEl.style.outline = oldOutline; }, 1000);
        return { success: true, message: `Klik [@e${cleanId}] berhasil${fuzzyNote}${coveredNote}.` };
      }

      if (action === "type" || action === "fill") {
        targetEl.focus();
        setNativeInputValue(targetEl, value || "");

        if (pressEnter) {
          targetEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          targetEl.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          targetEl.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          if (targetEl.form) targetEl.form.dispatchEvent(new Event("submit", { bubbles: true }));
        }

        const isPassword = targetEl instanceof HTMLInputElement && targetEl.type === "password";
        const displayVal = isPassword ? "••••••••" : value;
        setTimeout(() => { targetEl.style.outline = oldOutline; }, 1000);
        return { success: true, message: `Mengisi "${displayVal}" pada [@e${cleanId}] berhasil${fuzzyNote}.` };
      }

      if (action === "select") {
        targetEl.focus();
        if (targetEl instanceof HTMLSelectElement) {
          let optionFound = false;
          const targetVal = String(value || "").toLowerCase().trim();
          for (let i = 0; i < targetEl.options.length; i++) {
            const opt = targetEl.options[i];
            const optVal = (opt.value || "").toLowerCase().trim();
            const optTxt = (opt.text || "").toLowerCase().trim();
            if (optVal === targetVal || optTxt === targetVal || optTxt.includes(targetVal) || (targetVal.length > 2 && optVal.includes(targetVal))) {
              targetEl.selectedIndex = i;
              optionFound = true;
              break;
            }
          }
          targetEl.dispatchEvent(new Event("input", { bubbles: true }));
          targetEl.dispatchEvent(new Event("change", { bubbles: true }));
          return {
            success: optionFound,
            message: optionFound
              ? `Select dropdown [@e${cleanId}] ke "${targetEl.options[targetEl.selectedIndex].text}".`
              : `Pilihan "${value}" tidak ditemukan pada dropdown [@e${cleanId}].`
          };
        }
      }

      return { success: false, error: `Aksi "${action}" tidak didukung.` };
    } catch (err) {
      return { success: false, error: `Error eksekusi: ${err.message}` };
    }
  }

  // ─────────────────────────────────────────────────────
  // BATCH & SINGLE ACTION DISPATCHER
  // ─────────────────────────────────────────────────────
  async function executeAction(actionData) {
    if (!actionData) return { success: false, error: "Data aksi kosong" };

    // Dukung batched actions array ala agent-browser
    if (Array.isArray(actionData.actions) && actionData.actions.length > 0) {
      const results = [];
      for (const act of actionData.actions) {
        const res = await executeSingleAction(act);
        results.push(res);
        if (!res.success) {
          return {
            success: false,
            error: `Gagal pada batch step: ${res.error}`,
            batchResults: results
          };
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      return {
        success: true,
        message: `Berhasil mengeksekusi ${results.length} aksi batch.`,
        batchResults: results
      };
    }

    return await executeSingleAction(actionData);
  }

  // ─────────────────────────────────────────────────────
  // MESSAGE LISTENER
  // ─────────────────────────────────────────────────────
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
      executeAction(request.actionData).then((result) => sendResponse(result));
      return true;
    }

    if (request.type === "WAIT_FOR_DOM_STABLE") {
      const maxWait = request.maxWaitMs || 5000;
      const stableWindow = request.stableWindowMs || 600;
      waitForDOMStable(maxWait, stableWindow).then((result) => sendResponse(result));
      return true;
    }

    if (request.type === "WAIT_FOR_SELECTOR") {
      waitForSelector(request.selector, request.timeoutMs || 5000).then((result) => sendResponse(result));
      return true;
    }
  });
})();
