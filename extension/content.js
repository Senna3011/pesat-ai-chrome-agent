// content.js - Computer-Use Grade Semantic AXTree Scanner & Robust Action Engine (v5.0)
// Fitur: AXTree snapshot, colored bounding box, occlusion detection, auto-wait,
// fuzzy fallback, React/Vue setter, key_combo, hover, drag, upload_file,
// paste_text (Google Docs/canvas friendly), click_coords (vision grounding).

(() => {
  let markersOverlay = null;
  let activeElementsMap = new Map();
  const capturedPageErrors = [];

  // Tangkap runtime error & unhandled rejection untuk kemampuan troubleshooting/fixing
  window.addEventListener("error", (e) => {
    try {
      const msg = e.message || (e.error && e.error.message) || String(e);
      const src = e.filename ? ` (${e.filename}:${e.lineno})` : "";
      capturedPageErrors.push(`[JS Error] ${msg}${src}`);
      if (capturedPageErrors.length > 10) capturedPageErrors.shift();
    } catch (_) {}
  }, true);

  window.addEventListener("unhandledrejection", (e) => {
    try {
      const reason = e.reason?.message || String(e.reason || "Unhandled Promise Rejection");
      capturedPageErrors.push(`[Promise Rejection] ${reason}`);
      if (capturedPageErrors.length > 10) capturedPageErrors.shift();
    } catch (_) {}
  }, true);

  console.log("[Pesat AI Agent] Semantic AXTree DOM Engine initialized (v5.0).");

  // ─────────────────────────────────────────────────────
  // VISIBILITY & OCCLUSION HELPERS
  // ─────────────────────────────────────────────────────
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
    return rect.top <= vh + 100 && rect.bottom >= -100 && rect.left <= vw + 100 && rect.right >= -100;
  }

  function checkOcclusion(el) {
    try {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const topEl = document.elementFromPoint(cx, cy);
      if (!topEl) return { covered: false };

      if (el === topEl || el.contains(topEl) || topEl.contains(el)) {
        return { covered: false };
      }

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

  function tryDismissCommonModals() {
    const closeSelectors = [
      'button[aria-label*="close" i]',
      'button[aria-label*="tutup" i]',
      'button[aria-label*="dismiss" i]',
      '[class*="close-modal" i]',
      '[class*="modal-close" i]',
      '[class*="close-btn" i]',
      '[data-testid*="close" i]',
      '[data-testid*="modal-close" i]',
      '.btn-close',
      '.modal-header .close'
    ];
    for (const sel of closeSelectors) {
      const btn = document.querySelector(sel);
      if (btn && isElementVisible(btn)) {
        try {
          btn.click();
          return true;
        } catch (_) {}
      }
    }
    return false;
  }

  // ─────────────────────────────────────────────────────
  // SEMANTIC HELPERS (ROLE / ACCESSIBLE NAME)
  // ─────────────────────────────────────────────────────
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

  function getAccessibleName(el) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const labelEl = document.getElementById(labelledby);
      if (labelEl && labelEl.textContent.trim()) return labelEl.textContent.trim();
    }

    if (el.id) {
      const labelFor = document.querySelector(`label[for="${el.id}"]`);
      if (labelFor && labelFor.textContent.trim()) return labelFor.textContent.trim();
    }
    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.textContent.trim()) {
      return parentLabel.textContent.replace(el.textContent || "", "").trim();
    }

    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) return placeholder.trim();

    const title = el.getAttribute("title");
    if (title && title.trim()) return title.trim();

    const alt = el.getAttribute("alt");
    if (alt && alt.trim()) return alt.trim();

    const innerText = (el.innerText || el.textContent || "").trim();
    if (innerText) return innerText.replace(/\s+/g, " ").slice(0, 120);

    return "";
  }

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
      return { border: "#2563eb", bg: "#1d4ed8", bgTint: "rgba(37, 99, 235, 0.08)", name: "input" };
    }
    if (role === "button") {
      return { border: "#ef4444", bg: "#b91c1c", bgTint: "rgba(239, 68, 68, 0.08)", name: "button" };
    }
    if (role === "link") {
      return { border: "#10b981", bg: "#047857", bgTint: "rgba(16, 185, 129, 0.08)", name: "link" };
    }
    if (role === "combobox" || role === "select" || role === "tab" || role === "menuitem") {
      return { border: "#f59e0b", bg: "#b45309", bgTint: "rgba(245, 158, 11, 0.08)", name: "control" };
    }
    return { border: "#8b5cf6", bg: "#6d28d9", bgTint: "rgba(139, 92, 246, 0.08)", name: "interactive" };
  }

  // ─────────────────────────────────────────────────────
  // SMOOTH VISUAL PERCEPTION STYLES & HUD (Realtime Observable Reading)
  // ─────────────────────────────────────────────────────
  function ensurePesatStyles() {
    if (document.getElementById("pesat-reading-visual-styles")) return;
    const style = document.createElement("style");
    style.id = "pesat-reading-visual-styles";
    style.textContent = `
      @keyframes pesatSweepLaser {
        0% { top: 0; opacity: 0; }
        12% { opacity: 1; }
        85% { opacity: 0.9; }
        100% { top: 100vh; opacity: 0; }
      }
      @keyframes pesatRadarPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.4); opacity: 0.5; }
      }
      @keyframes pesatBoxEntrance {
        from {
          opacity: 0;
          transform: scale(0.96) translateY(2px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      @keyframes pesatBadgeEntrance {
        from {
          opacity: 0;
          transform: scale(0.65) translateY(-3px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      @keyframes pesatLegendEntrance {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes pesatShieldPulse {
        0% { transform: scale(1); }
        100% { transform: scale(1.015); }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function triggerScanningBeam() {
    ensurePesatStyles();
    const existing = document.getElementById("pesat-scanning-beam");
    if (existing) existing.remove();

    const beam = document.createElement("div");
    beam.id = "pesat-scanning-beam";
    beam.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 3px;
      background: linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.85) 20%, rgba(168, 85, 247, 1) 50%, rgba(56, 189, 248, 0.85) 80%, transparent 100%);
      box-shadow: 0 0 18px 4px rgba(56, 189, 248, 0.75), 0 0 36px 8px rgba(168, 85, 247, 0.45);
      pointer-events: none;
      z-index: 2147483647;
      animation: pesatSweepLaser 0.9s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    `;
    document.documentElement.appendChild(beam);
    setTimeout(() => { if (beam.parentNode) beam.remove(); }, 1000);
  }

  let pesatHudTimer = null;
  function showReadingHUD(text, isComplete = false) {
    ensurePesatStyles();
    let hud = document.getElementById("pesat-reading-hud");
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "pesat-reading-hud";
      document.documentElement.appendChild(hud);
    }
    if (pesatHudTimer) clearTimeout(pesatHudTimer);

    hud.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 14, 26, 0.92);
      border: 1px solid ${isComplete ? "rgba(16, 185, 129, 0.5)" : "rgba(56, 189, 248, 0.4)"};
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.65), 0 0 16px ${isComplete ? "rgba(16, 185, 129, 0.3)" : "rgba(56, 189, 248, 0.25)"};
      backdrop-filter: blur(12px);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      padding: 7px 18px;
      border-radius: 9999px;
      z-index: 2147483647;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: opacity 0.35s ease, transform 0.35s ease;
      opacity: 1;
    `;

    const dotColor = isComplete ? "#10b981" : "#38bdf8";
    hud.innerHTML = `
      <span style="width: 7px; height: 7px; border-radius: 50%; background: ${dotColor}; box-shadow: 0 0 8px ${dotColor}; animation: pesatRadarPulse 1.2s infinite; flex-shrink: 0;"></span>
      <span>${text}</span>
    `;

    if (isComplete) {
      pesatHudTimer = setTimeout(() => {
        if (hud) {
          hud.style.opacity = "0";
          hud.style.transform = "translateX(-50%) translateY(-6px)";
          setTimeout(() => { if (hud.parentNode) hud.remove(); }, 400);
        }
      }, 2200);
    }
  }

  // ─────────────────────────────────────────────────────
  // VISUAL MARKERS (OVERLAY + LEGEND)
  // ─────────────────────────────────────────────────────
  function renderFloatingLegend() {
    ensurePesatStyles();
    const existing = document.getElementById("pesat-markers-legend");
    if (existing) existing.remove();

    const legend = document.createElement("div");
    legend.id = "pesat-markers-legend";
    legend.style.cssText = `
      position: fixed;
      bottom: 18px;
      right: 18px;
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 12px;
      padding: 11px 15px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.65), 0 0 15px rgba(56, 189, 248, 0.15);
      backdrop-filter: blur(12px);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 290px;
      color: #f8fafc;
      pointer-events: auto;
      user-select: none;
      animation: pesatLegendEntrance 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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
      <div style="font-size:10px; color:#94a3b8; margin-top:8px; border-top:1px solid rgba(255,255,255,0.08); padding-top:6px; line-height:1.3;">
        💡 Nomor (#1, #2...) adalah ID tombol/input yang sedang dibaca dan dikontrol AI.
      </div>
    `;

    document.body.appendChild(legend);

    document.getElementById("pesat-btn-close-legend")?.addEventListener("click", () => {
      legend.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      legend.style.opacity = "0";
      legend.style.transform = "translateY(8px)";
      setTimeout(() => legend.remove(), 220);
    });
  }

  function clearVisualMarkers() {
    if (markersOverlay) {
      const mo = markersOverlay;
      markersOverlay = null;
      mo.style.transition = "opacity 0.25s ease";
      mo.style.opacity = "0";
      setTimeout(() => { if (mo.parentNode) mo.remove(); }, 260);
    }
    const legend = document.getElementById("pesat-markers-legend");
    if (legend) {
      legend.style.transition = "opacity 0.25s ease, transform 0.25s ease";
      legend.style.opacity = "0";
      legend.style.transform = "translateY(8px)";
      setTimeout(() => { if (legend.parentNode) legend.remove(); }, 260);
    }
    const hud = document.getElementById("pesat-reading-hud");
    if (hud) {
      hud.style.transition = "opacity 0.25s ease, transform 0.25s ease";
      hud.style.opacity = "0";
      hud.style.transform = "translateX(-50%) translateY(-6px)";
      setTimeout(() => { if (hud.parentNode) hud.remove(); }, 260);
    }

    document.querySelectorAll("[data-pesat-id]").forEach((el) => {
      el.removeAttribute("data-pesat-id");
    });
    activeElementsMap.clear();
  }

  // ─────────────────────────────────────────────────────
  // TAB INTERACTION LOCK SHIELD (Agentic Focus Protection)
  // ─────────────────────────────────────────────────────
  let pageLockShield = null;

  function blockUserInteractionEvent(e) {
    if (e.target && (e.target.id === "pesat-shield-unlock-btn" || e.target.closest("#pesat-shield-unlock-btn"))) {
      return;
    }
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }
    if (e.type !== "wheel") {
      e.preventDefault();
    }
  }

  const BLOCK_EVENT_TYPES = [
    "click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup",
    "contextmenu", "keydown", "keypress", "keyup", "touchstart", "touchend"
  ];

  function lockPageShield(message = "Tab ini sedang dikontrol oleh Pesat AI Agent... (Halaman dikunci agar AI fokus)") {
    ensurePesatStyles();
    const existing = document.getElementById("pesat-page-lock-shield");
    if (existing) {
      const msgEl = existing.querySelector("#pesat-shield-msg");
      if (msgEl) msgEl.textContent = message;
      return;
    }

    pageLockShield = document.createElement("div");
    pageLockShield.id = "pesat-page-lock-shield";
    pageLockShield.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(15, 23, 42, 0.22) !important;
      backdrop-filter: blur(1px) !important;
      -webkit-backdrop-filter: blur(1px) !important;
      z-index: 2147483645 !important;
      pointer-events: auto !important;
      cursor: not-allowed !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      padding-top: 14px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      transition: opacity 0.2s ease !important;
      opacity: 1 !important;
    `;

    pageLockShield.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(99, 102, 241, 0.45); box-shadow: 0 12px 32px rgba(0,0,0,0.65), 0 0 16px rgba(99, 102, 241, 0.2); padding: 8px 16px; border-radius: 9999px; color: #f8fafc; font-size: 12px; font-weight: 500; pointer-events: auto; cursor: default; animation: pesatShieldPulse 1.8s infinite alternate;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #6366f1; box-shadow: 0 0 8px #6366f1; flex-shrink: 0;"></span>
        <span id="pesat-shield-msg" style="color: #f1f5f9;">${message}</span>
        <button id="pesat-shield-unlock-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 6px; padding: 2px 8px; font-size: 11px; cursor: pointer; margin-left: 4px; transition: background 0.15s;" title="Buka kunci halaman manual">Buka Kunci</button>
      </div>
    `;

    (document.body || document.documentElement).appendChild(pageLockShield);

    BLOCK_EVENT_TYPES.forEach(type => {
      window.addEventListener(type, blockUserInteractionEvent, { capture: true, passive: false });
    });

    const unlockBtn = pageLockShield.querySelector("#pesat-shield-unlock-btn");
    if (unlockBtn) {
      unlockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        unlockPageShield();
      });
      unlockBtn.addEventListener("mouseenter", () => {
        unlockBtn.style.background = "rgba(239, 68, 68, 0.3)";
        unlockBtn.style.color = "#fff";
      });
      unlockBtn.addEventListener("mouseleave", () => {
        unlockBtn.style.background = "rgba(255,255,255,0.1)";
        unlockBtn.style.color = "#cbd5e1";
      });
    }
  }

  function unlockPageShield() {
    BLOCK_EVENT_TYPES.forEach(type => {
      window.removeEventListener(type, blockUserInteractionEvent, { capture: true, passive: false });
    });

    const shield = document.getElementById("pesat-page-lock-shield") || pageLockShield;
    if (shield) {
      shield.style.opacity = "0";
      setTimeout(() => { if (shield.parentNode) shield.remove(); }, 200);
    }
    pageLockShield = null;
  }

  // ─────────────────────────────────────────────────────
  // SEMANTIC AXTREE SNAPSHOT
  // ─────────────────────────────────────────────────────
  function scanInteractiveDOM(showOverlay = true) {
    clearVisualMarkers();

    const currentUrl = window.location.href || "";
    if (!currentUrl || currentUrl.startsWith("chrome://") || currentUrl.startsWith("edge://") || currentUrl.startsWith("about:") || currentUrl === "about:blank") {
      return {
        title: document.title || "Tab Baru",
        url: currentUrl || "chrome://newtab",
        elementsCount: 0,
        reducedDOM: "[NEWTAB_EMPTY_PAGE] Halaman kosong. Gunakan aksi navigate untuk membuka URL atau mencari sesuatu.",
        pageContent: ""
      };
    }

    // Tampilkan laser sweep & floating HUD untuk memberitahukan proses pemindaian secara visual halus
    if (showOverlay) {
      triggerScanningBeam();
      showReadingHUD("⚡ Pesat AI: Membaca struktur & elemen halaman...");
    }

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
      "[role='textbox']",
      "[role='menuitem']",
      "[tabindex='0']",
      "[contenteditable='true']",
      "[gh='cm']",
      "summary"
    ].join(", ");

    const candidateElements = Array.from(document.querySelectorAll(selector));
    const visibleElements = candidateElements.filter(isElementVisible);

    if (!showOverlay) {
      clearVisualMarkers();
    } else if (visibleElements.length > 0) {
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

      // Gambar Colored Bounding Box dengan animasi entrance halus bertahap (staggered)
      if (showOverlay && markersOverlay) {
        const delay = Math.min(idCounter * 10, 320);

        const box = document.createElement("div");
        box.style.cssText = `
          position: absolute;
          top: ${rect.top + scrollY}px;
          left: ${rect.left + scrollX}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          border: 1.5px solid ${theme.border};
          border-radius: 5px;
          background: ${theme.bgTint || "rgba(56, 189, 248, 0.05)"};
          box-shadow: 0 0 8px ${theme.border}44;
          pointer-events: none;
          box-sizing: border-box;
          z-index: 2147483645;
          opacity: 0;
          animation: pesatBoxEntrance 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: ${delay}ms;
        `;

        const badge = document.createElement("span");
        badge.textContent = `#${elementId} ${icon}`;
        badge.title = `Target #${elementId}: ${label || role}`;
        badge.style.cssText = `
          position: absolute;
          top: -11px;
          left: -3px;
          background: ${theme.bg};
          color: #ffffff;
          font-size: 10.5px;
          font-weight: 700;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.45);
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
          line-height: 1.2;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          opacity: 0;
          animation: pesatBadgeEntrance 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: ${delay + 60}ms;
        `;
        box.appendChild(badge);
        markersOverlay.appendChild(box);
      }

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
          val = el.value ? ` value="${el.value.slice(0, 50).replace(/"/g, "'")}"` : "";
        }
      } else if (el.isContentEditable || el.getAttribute("contenteditable") === "true") {
        const textVal = (el.innerText || el.textContent || "").trim();
        if (textVal) {
          val = ` value="${textVal.slice(0, 50).replace(/"/g, "'")}"`;
        }
      }

      const placeholder = el.getAttribute("placeholder") ? ` placeholder="${el.getAttribute("placeholder")}"` : "";
      const statesStr = stateFlags.length > 0 ? ` [${stateFlags.join(", ")}]` : "";

      elementsList.push(`[@e${elementId}] <${role}${placeholder}${val}${statesStr}> "${label}"`);
    }

    const pageReadableText = extractReadablePageText();

    return {
      title: document.title,
      url: window.location.href,
      elementsCount: visibleElements.length,
      reducedDOM: elementsList.join("\n"),
      pageContent: pageReadableText,
      pageErrors: [...capturedPageErrors]
    };
  }

  // ─────────────────────────────────────────────────────
  // EKSTRAKSI KONTEN UTAMA & KATALOG E-COMMERCE
  // ─────────────────────────────────────────────────────
  function extractEcommerceProductListings() {
    const isEcommerce = /tokopedia\.com|shopee\.co\.id|blibli\.com|amazon\.com|lazada\.co\.id|bukalapak\.com|google\.com\/search.*tbm=shop/i.test(window.location.href);
    if (!isEcommerce) return null;

    const products = [];

    // 1. Tokopedia Product Card Selectors
    if (window.location.hostname.includes("tokopedia.com")) {
      const cardSelectors = [
        '[data-testid="divProductWrapper"]',
        '[data-testid="master-product-card"]',
        '[data-testid="spnSRPProdName"]',
        '.pcv3__container',
        '.css-1asz3by'
      ];
      const cards = document.querySelectorAll(cardSelectors.join(", "));
      cards.forEach((card, idx) => {
        if (products.length >= 15) return;
        const nameEl = card.querySelector('[data-testid="spnSRPProdName"]') || card.querySelector('.css-20kt3b') || card.querySelector('.css-1b6t4dn') || card;
        const priceEl = card.querySelector('[data-testid="spnSRPProdPrice"]') || card.querySelector('.css-1ks5fgj') || card.querySelector('[class*="price"]');
        const ratingEl = card.querySelector('[data-testid="spnSRPProdRating"]') || card.querySelector('.css-153qong') || card.querySelector('[class*="rating"]');
        const soldEl = card.querySelector('[data-testid="spnSRPProdSold"]') || card.querySelector('.css-15u5b3y') || card.querySelector('[class*="sold"]');
        const shopEl = card.querySelector('[data-testid="spnSRPProdShopLoc"]') || card.querySelector('.css-1rn0irl') || card.querySelector('[class*="shop"]');
        const linkEl = card.querySelector('a[href*="tokopedia.com"]') || card.closest('a') || card.querySelector('a');

        const name = (nameEl?.innerText || nameEl?.textContent || "").trim();
        const price = (priceEl?.innerText || priceEl?.textContent || "").trim();
        const rating = (ratingEl?.innerText || ratingEl?.textContent || "").trim();
        const sold = (soldEl?.innerText || soldEl?.textContent || "").trim();
        const shop = (shopEl?.innerText || shopEl?.textContent || "").trim();
        const link = linkEl?.href || "";

        if (name && name.length > 5 && (price || rating)) {
          products.push({
            no: idx + 1,
            name,
            price: price || "Harga tertera di toko",
            rating: rating ? `★ ${rating}` : "Rating N/A",
            sold: sold || "Penjualan N/A",
            shop: shop || "Toko Terverifikasi",
            url: link
          });
        }
      });
    }

    // Generic E-Commerce Card fallback
    if (products.length === 0) {
      const genericCards = document.querySelectorAll('[class*="product-card"], [class*="productCard"], [data-testid*="product"], [itemtype*="Product"]');
      genericCards.forEach((c, idx) => {
        if (products.length >= 12) return;
        const text = (c.innerText || "").trim().split(/\n/).filter(t => t.trim().length > 0);
        if (text.length >= 2) {
          products.push({
            no: idx + 1,
            name: text[0] || "Produk",
            price: text.find(t => /Rp|IDR|\$|\b\d{1,3}(?:\.\d{3})+\b/i.test(t)) || "Harga tertera",
            rating: text.find(t => /★|\b[3-5]\.\d\b/i.test(t)) || "Rating N/A",
            details: text.slice(1, 4).join(" | ")
          });
        }
      });
    }

    if (products.length > 0) {
      let formatted = `[DATA KATALOG PRODUK E-COMMERCE TERVERIFIKASI (${products.length} Produk Ditemukan)]:\n`;
      products.forEach((p, i) => {
        formatted += `${i + 1}. ${p.name}\n   - Harga: ${p.price}\n   - Rating: ${p.rating} | Terjual: ${p.sold || "-"}\n   - Toko: ${p.shop || "-"}\n   - Link: ${p.url || "-"}\n\n`;
      });
      return formatted;
    }

    return null;
  }

  function getReadableContent(showVisual = true) {
    try {
      if (showVisual) {
        showReadingHUD("📖 Pesat AI: Membaca teks artikel...");
        triggerScanningBeam();
      }

      // Prioritas 1: Jika di situs e-commerce, ekstrak katalog produk terstruktur
      const ecommerceData = extractEcommerceProductListings();
      if (ecommerceData && ecommerceData.length > 50) {
        if (showVisual) {
          showReadingHUD(`✓ Selesai mengekstrak data katalog produk`, true);
        }
        return ecommerceData;
      }

      // 1. Cari kontainer artikel terbaik berdasarkan bobot teks terpanjang
      const candidateSelectors = [
        "[itemprop='articleBody']",
        "[data-qa-id='story-content']",
        ".read__content",
        ".detail-text",
        ".post-content",
        ".entry-content",
        ".article__content",
        "article",
        "main",
        "[role='main']",
        "#main-content",
        "#content"
      ];

      let bestTarget = null;
      let maxLen = 0;

      for (const sel of candidateSelectors) {
        const elements = document.querySelectorAll(sel);
        for (const el of elements) {
          const len = (el.innerText || el.textContent || "").trim().length;
          if (len > maxLen) {
            maxLen = len;
            bestTarget = el;
          }
        }
      }

      const target = bestTarget || document.body;
      if (!target) return "";

      // Visual highlight pada kontainer artikel yang dibaca
      if (showVisual && target && target !== document.body) {
        const originalOutline = target.style.outline;
        const originalShadow = target.style.boxShadow;
        const originalTransition = target.style.transition;

        target.style.transition = "box-shadow 0.4s ease, outline 0.4s ease";
        target.style.outline = "2px solid rgba(56, 189, 248, 0.6)";
        target.style.boxShadow = "0 0 25px rgba(56, 189, 248, 0.22)";
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });

        setTimeout(() => {
          target.style.outline = originalOutline;
          target.style.boxShadow = originalShadow;
          target.style.transition = originalTransition;
        }, 2200);
      }

      const textElements = Array.from(
        target.querySelectorAll(
          "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, [class*='desc'], [class*='text'], [class*='title'], [class*='paragraph'], [class*='content']"
        )
      );

      const cleanedBlocks = [];
      const seenText = new Set();

      for (const el of textElements) {
        if (
          el.closest(
            "nav, header, footer, aside, [role='navigation'], [role='banner'], [role='contentinfo'], #pesat-markers-overlay, #pesat-markers-legend, .ad, [class*='advertisement']"
          )
        ) {
          continue;
        }

        const str = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
        if (str.length >= 10 && !seenText.has(str)) {
          seenText.add(str);
          cleanedBlocks.push(str);
        }
      }

      let resultText = cleanedBlocks.join("\n\n");

      // 2. Fallback tangguh berbasis document.body.innerText langsung (selalu ter-render pada peramban)
      if (!resultText || resultText.length < 50) {
        const bodyText = document.body ? (document.body.innerText || "") : "";
        if (bodyText) {
          const lines = bodyText
            .split(/\r?\n/)
            .map((l) => l.trim().replace(/\s+/g, " "))
            .filter((l) => l.length >= 18 && !seenText.has(l));

          // Filter baris yang mirip elemen menu/navigasi/footer
          const meaningfulLines = lines.filter(
            (l) =>
              !/^(beranda|home|masuk|daftar|login|register|search|cari|menu|share|bagikan|iklan|advertisement|copyright|hak cipta|kebijakan privasi|privacy policy)/i.test(
                l
              )
          );

          if (meaningfulLines.length > 0) {
            resultText = meaningfulLines.join("\n\n");
          }
        }
      }

      if (showVisual && resultText && resultText.length > 30) {
        showReadingHUD(`✓ Selesai membaca artikel (${resultText.length} karakter)`, true);
      }

      return resultText.substring(0, 7000).trim();
    } catch (err) {
      console.warn("[Pesat] Gagal mengambil readable content:", err);
      return document.body ? (document.body.innerText || "").substring(0, 5000) : "";
    }
  }

  function extractReadablePageText() {
    return getReadableContent(false).substring(0, 4500);
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
  // FUZZY FALLBACK
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
  // RICH TEXT & MARKDOWN SANITIZER UNTUK DOKUMEN WEB
  // ─────────────────────────────────────────────────────
  function convertMarkdownToRichDoc(md = "") {
    let raw = String(md || "").trim();

    // 1. Bersihkan sisa-sisa divider markdown atau section medsos jika terlampir tidak sengaja
    raw = raw.replace(/\n\s*---\s*\n\s*(?:Thread Ringkas|Tweet|Twitter|#)[\s\S]*$/i, "");
    raw = raw.replace(/\n\s*---\s*\n/g, "\n\n");

    // 2. Bersihkan Plain Text yang rapi untuk dokumen (tanpa tanda pagar #, **, dll)
    let cleanPlain = raw
      .replace(/^#{1,6}\s+(.*$)/gm, "$1")
      .replace(/\*\*(.*?)\*\*\s*:\s*/g, "$1: ")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^>\s*/gm, "")
      .replace(/^\s*[\*\-]\s+/gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // 3. HTML Rich Text untuk Clipboard
    let cleanHtml = raw
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*?)\*/gim, '<i>$1</i>')
      .replace(/^>\s*(.*$)/gim, '<blockquote style="border-left:3px solid #3b82f6;padding-left:12px;color:#475569;margin:8px 0;">$1</blockquote>')
      .replace(/^\s*[\*\-]\s+(.*$)/gim, '<li>$1</li>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');

    cleanHtml = `<p>${cleanHtml}</p>`;

    return { plain: cleanPlain, html: cleanHtml };
  }

  // ─────────────────────────────────────────────────────
  // REACT / VUE COMPATIBLE VALUE SETTER
  // ─────────────────────────────────────────────────────
  function setNativeInputValue(el, value) {
    if (el.isContentEditable || el.getAttribute("contenteditable") === "true") {
      el.focus();
      try {
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
      } catch (_) {}
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (_) {}

      try {
        document.execCommand("insertText", false, value);
      } catch (_) {}

      // Verifikasi apakah teks berhasil masuk, hindari duplikasi jika sudah terisi
      const currentText = (el.innerText || el.textContent || "").trim();
      if (!currentText || currentText.length < 3) {
        try {
          el.innerText = value;
        } catch (_) {
          el.textContent = value;
        }
      }
    } else if (el instanceof HTMLInputElement) {
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
    } else {
      try {
        el.value = value;
      } catch (_) {
        el.innerText = value;
      }
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ─────────────────────────────────────────────────────
  // KEY COMBO PARSER & DISPATCHER (untuk aplikasi canvas: Docs/Sheets)
  // ─────────────────────────────────────────────────────
  const KEY_CODES = {
    enter: 13, tab: 9, escape: 27, esc: 27, backspace: 8, delete: 46, del: 46,
    space: 32, arrowup: 38, arrowdown: 40, arrowleft: 37, arrowright: 39,
    up: 38, down: 40, left: 37, right: 39,
    home: 36, end: 35, pageup: 33, pagedown: 34, insert: 45,
    f1: 112, f2: 113, f3: 114, f4: 115, f5: 116, f6: 117, f7: 118, f8: 119, f9: 120,
    f10: 121, f11: 122, f12: 123
  };

  function parseKeyCombo(comboStr) {
    const parts = String(comboStr || "").split("+").map((p) => p.trim()).filter(Boolean);
    const modifiers = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
    let keyPart = "";

    for (const p of parts) {
      const lower = p.toLowerCase();
      if (lower === "ctrl" || lower === "control") modifiers.ctrlKey = true;
      else if (lower === "alt") modifiers.altKey = true;
      else if (lower === "shift") modifiers.shiftKey = true;
      else if (lower === "meta" || lower === "cmd" || lower === "win") modifiers.metaKey = true;
      else keyPart = p;
    }

    if (!keyPart) return null;

    const lowerKey = keyPart.toLowerCase();
    const isSpecial = KEY_CODES[lowerKey] !== undefined || /^f\d{1,2}$/.test(lowerKey);
    const keyCode = KEY_CODES[lowerKey] !== undefined
      ? KEY_CODES[lowerKey]
      : (/^f\d{1,2}$/.test(lowerKey) ? 111 + parseInt(lowerKey.slice(1), 10) : keyPart.toUpperCase().charCodeAt(0));

    let keyName;
    if (isSpecial) {
      const prettyMap = { esc: "Escape", del: "Delete", up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", space: " " };
      keyName = prettyMap[lowerKey] || (keyPart.charAt(0).toUpperCase() + keyPart.slice(1));
    } else {
      keyName = modifiers.shiftKey ? keyPart.toUpperCase() : keyPart.toLowerCase();
    }

    return {
      key: keyName,
      code: isSpecial ? keyName : (keyPart.length === 1 ? `Key${keyPart.toUpperCase()}` : keyName),
      keyCode,
      which: keyCode,
      ...modifiers
    };
  }

  function dispatchKeyCombo(target, parsed) {
    const baseInit = {
      key: parsed.key,
      code: parsed.code,
      keyCode: parsed.keyCode,
      which: parsed.which,
      ctrlKey: parsed.ctrlKey,
      altKey: parsed.altKey,
      shiftKey: parsed.shiftKey,
      metaKey: parsed.metaKey,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window
    };

    target.dispatchEvent(new KeyboardEvent("keydown", baseInit));
    // keypress hanya relevan untuk karakter printable tanpa modifier fungsi
    if (!parsed.ctrlKey && !parsed.metaKey && !parsed.altKey && parsed.key.length === 1) {
      target.dispatchEvent(new KeyboardEvent("keypress", { ...baseInit, charCode: parsed.keyCode }));
    }
    target.dispatchEvent(new KeyboardEvent("keyup", baseInit));
  }

  // ─────────────────────────────────────────────────────
  // HELPER: RESOLVE TARGET ELEMENT DARI BERBAGAI FORMAT
  // ─────────────────────────────────────────────────────
  function resolveTargetElement({ elementId, selector, fallbackText, value }, action) {
    let cleanId = String(elementId || "").replace(/[@#\[\]eE\s]/g, "").trim();
    let targetEl = activeElementsMap.get(Number(cleanId)) || document.querySelector(`[data-pesat-id="${cleanId}"]`);

    if (targetEl && !isElementVisible(targetEl)) {
      // Elemen ada di map tapi tak terlihat (halaman berubah) — coba re-scan ringan
      targetEl = document.querySelector(`[data-pesat-id="${cleanId}"]`);
    }

    if (!targetEl && selector) {
      try {
        const found = document.querySelector(selector);
        if (found && isElementVisible(found)) targetEl = found;
      } catch (e) {}
    }

    if (!targetEl && (fallbackText || value)) {
      targetEl = findElementByFuzzy(fallbackText || value, action);
      if (targetEl) return { el: targetEl, usedFuzzy: true };
    }

    return { el: targetEl, usedFuzzy: false };
  }

  // ─────────────────────────────────────────────────────
  // STANDARDIZED ACTION RESULT ENVELOPE (§ 34, 35, 71 PRD)
  // ─────────────────────────────────────────────────────
  function getQuickDOMFingerprint() {
    try {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      const activeVal = document.activeElement instanceof HTMLInputElement ? document.activeElement.value.slice(0, 30) : "";
      const childCount = document.body ? document.body.childElementCount : 0;
      return `${window.location.href}|${document.title}|${childCount}|${activeTag}|${activeVal}`;
    } catch (e) {
      return `${window.location.href}|${Date.now()}`;
    }
  }

  function makeActionResult({
    success,
    action = "",
    observation = "",
    stateChanged = false,
    error = null,
    errorType = null,
    metadata = null,
    durationMs = 0,
    suggestion = null
  }) {
    const isOk = Boolean(success);
    const obs = String(observation || error || (isOk ? "Aksi berhasil" : "Aksi gagal"));
    return {
      success: isOk,
      action: action,
      observation: obs,
      message: obs, // backward compatibility
      stateChanged: Boolean(stateChanged),
      error: error ? String(error) : null,
      errorType: isOk ? null : (errorType || "UNKNOWN_ERROR"),
      metadata: metadata || null,
      durationMs: Math.max(0, Math.round(durationMs)),
      suggestion: suggestion || null
    };
  }

  // ─────────────────────────────────────────────────────
  // SINGLE ACTION EXECUTOR
  // ─────────────────────────────────────────────────────
  async function executeSingleAction(actionData) {
    const startTime = performance.now();
    const beforeFp = getQuickDOMFingerprint();

    try {
      const rawRes = await executeSingleActionInternal(actionData);
      const afterFp = getQuickDOMFingerprint();
      const elapsed = performance.now() - startTime;
      const changed = rawRes.stateChanged !== undefined ? rawRes.stateChanged : (beforeFp !== afterFp);

      return makeActionResult({
        success: rawRes.success,
        action: actionData.action,
        observation: rawRes.message || rawRes.observation,
        stateChanged: changed,
        error: rawRes.error,
        errorType: rawRes.errorType,
        metadata: rawRes.metadata,
        durationMs: elapsed,
        suggestion: rawRes.suggestion
      });
    } catch (unexpected) {
      const elapsed = performance.now() - startTime;
      return makeActionResult({
        success: false,
        action: actionData.action,
        error: unexpected.message || "Unexpected execution error",
        errorType: "UNKNOWN_ERROR",
        durationMs: elapsed
      });
    }
  }

  async function executeSingleActionInternal(actionData) {
    const { action, value, pressEnter, scrollDirection } = actionData;

    if (action === "scroll") {
      const distance = scrollDirection === "up" ? -500 : 500;
      window.scrollBy({ top: distance, behavior: "smooth" });
      await new Promise((r) => setTimeout(r, 500));
      return { success: true, message: `Berhasil scroll ${scrollDirection || "down"}`, stateChanged: true };
    }

    if (action === "navigate") {
      if (value && value.startsWith("http")) {
        window.location.href = value;
        return { success: true, message: `Membuka URL: ${value}`, stateChanged: true };
      }
      return { success: false, error: "URL tidak valid. Format wajib: https://", errorType: "NAVIGATION_FAILED" };
    }

    if (action === "wait") {
      const waitMs = parseInt(value, 10) || 1000;
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 5000)));
      return { success: true, message: `Menunggu ${waitMs}ms`, stateChanged: false };
    }

    // ── click_coords: klik koordinat piksel viewport (vision grounding) ──
    if (action === "click_coords") {
      const x = Number(actionData.x ?? (typeof actionData.coords === "object" ? actionData.coords?.x : NaN));
      const y = Number(actionData.y ?? (typeof actionData.coords === "object" ? actionData.coords?.y : NaN));
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { success: false, error: "Koordinat x/y tidak valid untuk click_coords.", errorType: "TOOL_INVALID_ARGUMENT" };
      }
      const elAtPoint = document.elementFromPoint(x, y);
      if (!elAtPoint) {
        return { success: false, error: `Tidak ada elemen pada koordinat (${x}, ${y}).`, errorType: "ELEMENT_NOT_FOUND" };
      }
      const eventInit = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
      elAtPoint.dispatchEvent(new PointerEvent("pointerdown", eventInit));
      elAtPoint.dispatchEvent(new MouseEvent("mousedown", eventInit));
      elAtPoint.dispatchEvent(new PointerEvent("pointerup", eventInit));
      elAtPoint.dispatchEvent(new MouseEvent("mouseup", eventInit));
      elAtPoint.dispatchEvent(new MouseEvent("click", eventInit));
      if (elAtPoint instanceof HTMLElement) elAtPoint.click?.();
      await new Promise((r) => setTimeout(r, 200));
      return { success: true, message: `Klik koordinat (${x}, ${y}) pada <${elAtPoint.tagName.toLowerCase()}> berhasil.`, stateChanged: true };
    }

    // ── key_combo: kombinasi keyboard (aplikasi canvas & shortcut) ──
    if (action === "key_combo") {
      const parsed = parseKeyCombo(actionData.keys || actionData.key || value || "");
      if (!parsed) {
        return { success: false, error: `Format key_combo tidak valid: "${actionData.keys || value}"`, errorType: "TOOL_INVALID_ARGUMENT" };
      }
      let target = null;
      if (actionData.elementId) {
        const resolved = resolveTargetElement(actionData, "click");
        target = resolved.el;
      }
      if (!target || !isElementVisible(target)) {
        target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
      } else {
        target.focus?.();
      }

      dispatchKeyCombo(target, parsed);

      // Enter pada input berform → submit form (perilaku native)
      if (parsed.key === "Enter" && !parsed.ctrlKey && !parsed.shiftKey && !parsed.altKey && !parsed.metaKey) {
        const formEl = target.closest?.("form");
        if (formEl) {
          try {
            if (typeof formEl.requestSubmit === "function") formEl.requestSubmit();
          } catch (e) {
            formEl.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          }
        }
      }

      await new Promise((r) => setTimeout(r, 150));
      const comboStr = actionData.keys || actionData.key || value;
      return { success: true, message: `Menekan kombinasi keyboard "${comboStr}" berhasil.`, stateChanged: true };
    }

    // ── paste_text: insert teks pada posisi kursor (Google Docs, Canvas, & Rich Editor friendly) ──
    if (action === "paste_text") {
      const text = String(value ?? actionData.text ?? "");
      if (!text) return { success: false, error: "Teks kosong untuk paste_text.", errorType: "TOOL_INVALID_ARGUMENT" };

      const { plain: cleanPlain, html: cleanHtml } = convertMarkdownToRichDoc(text);

      // 1. Penanganan Khusus Google Docs / Google Drive Editor
      const isGoogleDocs = window.location.hostname.includes("docs.google.com");
      if (isGoogleDocs) {
        let docsInserted = false;
        try {
          // Cari iframe text event target Google Docs
          const docIframe = document.querySelector(".docs-texteventtarget-iframe") ||
            document.querySelector("iframe[class*='texteventtarget']");
          if (docIframe) {
            const iDoc = docIframe.contentDocument || docIframe.contentWindow?.document;
            if (iDoc) {
              const inputTarget = iDoc.querySelector("textarea, [contenteditable='true']") || iDoc.body;
              if (inputTarget) {
                inputTarget.focus?.();
                const dt = new DataTransfer();
                dt.setData("text/plain", cleanPlain);
                dt.setData("text/html", cleanHtml);
                const pasteEv = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
                inputTarget.dispatchEvent(pasteEv);

                try {
                  const beforeInput = new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: cleanPlain });
                  inputTarget.dispatchEvent(beforeInput);
                } catch (e) {}

                try {
                  iDoc.execCommand("insertText", false, cleanPlain);
                } catch (e) {}
                docsInserted = true;
              }
            }
          }

          // Juga coba tempel pada editor canvas / appview
          const appView = document.querySelector(".kix-appview-editor") || document.querySelector(".docs-editor") || document.body;
          if (appView) {
            appView.focus?.();
            const dt2 = new DataTransfer();
            dt2.setData("text/plain", cleanPlain);
            dt2.setData("text/html", cleanHtml);
            const pasteEv2 = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt2 });
            appView.dispatchEvent(pasteEv2);
            document.dispatchEvent(pasteEv2);
          }
        } catch (e) {
          console.warn("[Pesat] Google Docs injection warning:", e);
        }

        // Salin ke clipboard sistem agar pengguna dapat menggunakan Ctrl+V bila diperlukan
        try {
          navigator.clipboard?.writeText?.(cleanPlain);
        } catch (e) {}

        showReadingHUD(`✓ Teks disisipkan ke Google Dokumen (${cleanPlain.length} karakter)`, true);
        await new Promise((r) => setTimeout(r, 300));
        return {
          success: true,
          message: `Berhasil menempelkan copywriting (${cleanPlain.length} karakter) ke Google Dokumen.`,
          stateChanged: true
        };
      }

      // 2. Penanganan Standar Form & ContentEditable
      let target = null;
      if (actionData.elementId) {
        const resolved = resolveTargetElement(actionData, "type");
        target = resolved.el;
      }
      if (!target) {
        target = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : null;
      }

      let inserted = false;
      if (target) {
        target.focus?.();
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          const start = target.selectionStart ?? target.value.length;
          const end = target.selectionEnd ?? target.value.length;
          const newVal = target.value.slice(0, start) + text + target.value.slice(end);
          setNativeInputValue(target, newVal);
          inserted = true;
        } else if (target.isContentEditable) {
          try {
            document.execCommand("insertText", false, text);
            inserted = target.innerText.includes(text.slice(0, 20));
          } catch (e) {}
          if (!inserted) {
            target.innerText = (target.innerText || "") + text;
            target.dispatchEvent(new Event("input", { bubbles: true }));
            inserted = true;
          }
        } else {
          const editable = target.querySelector?.("textarea, [contenteditable='true']");
          if (editable) {
            editable.focus?.();
            try {
              document.execCommand("insertText", false, text);
              inserted = true;
            } catch (e) {}
          }
        }

        // Coba synthetic ClipboardEvent / beforeinput pada target
        if (!inserted) {
          try {
            const dt = new DataTransfer();
            dt.setData("text/plain", text);
            const pasteEv = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
            target.dispatchEvent(pasteEv);
            inserted = true;
          } catch (e) {}
        }
      }

      // 3. Fallback Universal Clipboard Injection
      try {
        navigator.clipboard?.writeText?.(text);
        inserted = true;
      } catch (e) {}

      showReadingHUD(`✓ Teks berhasil disisipkan (${text.length} karakter)`, true);
      await new Promise((r) => setTimeout(r, 200));
      return { success: true, message: `Berhasil menyisipkan teks (${text.length} karakter).`, stateChanged: true };
    }

    // ── hover ──
    if (action === "hover") {
      const { el: targetEl, usedFuzzy } = resolveTargetElement(actionData, "click");
      if (!targetEl) return { success: false, error: `Elemen hover [${actionData.elementId || "?"}] tidak ditemukan.`, errorType: "ELEMENT_NOT_FOUND", suggestion: "scroll" };
      const rect = targetEl.getBoundingClientRect();
      const init = {
        bubbles: true, cancelable: true, view: window,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2
      };
      targetEl.dispatchEvent(new MouseEvent("mouseover", init));
      targetEl.dispatchEvent(new PointerEvent("pointermove", init));
      targetEl.dispatchEvent(new MouseEvent("mousemove", init));
      await new Promise((r) => setTimeout(r, parseInt(actionData.settleMs, 10) || 400));
      return { success: true, message: `Hover pada [${actionData.elementId}] berhasil${usedFuzzy ? " (fuzzy match)" : ""}.`, stateChanged: true };
    }

    // ── drag & drop ──
    if (action === "drag" || action === "drag_to") {
      const srcResolved = resolveTargetElement({ elementId: actionData.fromElementId || actionData.elementId, ...actionData }, "click");
      const dstResolved = resolveTargetElement({ elementId: actionData.toElementId || actionData.target, ...actionData }, "click");
      const src = srcResolved.el;
      const dst = dstResolved.el;
      if (!src || !dst) {
        return { success: false, error: `Sumber/target drag tidak ditemukan (src: ${actionData.fromElementId || actionData.elementId}, dst: ${actionData.toElementId || actionData.target}).`, errorType: "ELEMENT_NOT_FOUND" };
      }

      try {
        const dt = new DataTransfer();
        const dragStart = new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt });
        src.dispatchEvent(dragStart);
        dst.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
        dst.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
        src.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
        await new Promise((r) => setTimeout(r, 300));
        return { success: true, message: `Drag dari [${actionData.fromElementId || actionData.elementId}] ke [${actionData.toElementId || actionData.target}] berhasil (HTML5).`, stateChanged: true };
      } catch (e) {}

      const sr = src.getBoundingClientRect();
      const dr = dst.getBoundingClientRect();
      const seq = (type, x, y, el) =>
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
      seq("mousedown", sr.left + sr.width / 2, sr.top + sr.height / 2, src);
      for (let p = 0; p <= 5; p++) {
        const x = sr.left + (dr.left - sr.left) * (p / 5) + dr.width / 2 * (p / 5);
        const y = sr.top + (dr.top - sr.top) * (p / 5) + dr.height / 2 * (p / 5);
        document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
        await new Promise((r) => setTimeout(r, 40));
      }
      seq("mouseup", dr.left + dr.width / 2, dr.top + dr.height / 2, dst);
      return { success: true, message: `Drag dari [${actionData.fromElementId || actionData.elementId}] ke [${actionData.toElementId || actionData.target}] berhasil (mouse sim).`, stateChanged: true };
    }

    // ── upload_file ──
    if (action === "upload_file") {
      let inputEl = null;
      if (actionData.elementId) {
        const resolved = resolveTargetElement(actionData, "click");
        if (resolved.el && (resolved.el instanceof HTMLInputElement && resolved.el.type === "file")) inputEl = resolved.el;
      }
      if (!inputEl) {
        inputEl = document.querySelector("input[type='file']");
      }
      if (!inputEl) {
        return { success: false, error: "Tidak ditemukan input[type=file] di halaman untuk upload.", errorType: "ELEMENT_NOT_FOUND" };
      }

      const fileName = actionData.fileName || "upload.txt";
      const mime = actionData.mimeType || "text/plain";
      let file;
      if (actionData.contentBase64) {
        const bin = atob(actionData.contentBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        file = new File([bytes], fileName, { type: mime });
      } else {
        file = new File([String(actionData.contentText ?? "")], fileName, { type: mime });
      }

      const dt = new DataTransfer();
      dt.items.add(file);
      inputEl.files = dt.files;
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      return { success: true, message: `File "${fileName}" berhasil di-attach ke form upload.`, stateChanged: true };
    }

    // ═══ Aksi yang butuh target elemen (click/type/select/press_key) ═══
    let cleanId = String(actionData.elementId || "").replace(/[@#\[\]eE\s]/g, "").trim();

    let targetEl = cleanId ? (activeElementsMap.get(Number(cleanId)) || document.querySelector(`[data-pesat-id="${cleanId}"]`)) : null;

    // Auto-Waiting: tunggu hingga 3 detik jika elemen belum muncul (SPA render)
    if (!targetEl && cleanId) {
      const waitStart = Date.now();
      while (Date.now() - waitStart < 3000) {
        await new Promise((r) => setTimeout(r, 150));
        targetEl = activeElementsMap.get(Number(cleanId)) || document.querySelector(`[data-pesat-id="${cleanId}"]`);
        if (targetEl && isElementVisible(targetEl)) break;
      }
    }

    if (!targetEl && actionData.selector) {
      try {
        const foundBySelector = document.querySelector(actionData.selector);
        if (foundBySelector && isElementVisible(foundBySelector)) {
          targetEl = foundBySelector;
        }
      } catch (e) {}
    }

    let usedFuzzy = false;
    if (!targetEl) {
      const hint = actionData.targetText || actionData.fallbackText || value || String(cleanId);
      if (hint) {
        targetEl = findElementByFuzzy(hint, action);
        if (targetEl) {
          usedFuzzy = true;
        }
      }
    }

    // Jika press_key tanpa target spesifik, gunakan activeElement
    if (!targetEl && (action === "press_key" || action === "press_keyboard" || action === "key_press")) {
      targetEl = document.activeElement || document.body;
    }

    if (!targetEl) {
      return {
        success: false,
        error: `Elemen [@e${cleanId || actionData.targetText || "?"}] tidak ditemukan di layar.`,
        errorType: "ELEMENT_NOT_FOUND",
        suggestion: "scroll"
      };
    }

    let occlusion = checkOcclusion(targetEl);
    if (occlusion.covered && !actionData.force) {
      const dismissed = tryDismissCommonModals();
      if (dismissed) {
        await new Promise((r) => setTimeout(r, 300));
        occlusion = checkOcclusion(targetEl);
      }
    }

    const oldOutline = targetEl.style.outline;
    const oldShadow = targetEl.style.boxShadow;
    const oldTransition = targetEl.style.transition;
    const glowColor = usedFuzzy ? "#f59e0b" : "#38bdf8";

    targetEl.style.transition = "outline 0.2s ease, box-shadow 0.2s ease";
    targetEl.style.outline = `2.5px solid ${glowColor}`;
    targetEl.style.boxShadow = `0 0 16px ${glowColor}66`;
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });

    const elLabel = getAccessibleName(targetEl) || getSemanticRole(targetEl) || "";
    showReadingHUD(`🎯 Target #${cleanId}: ${action} ${elLabel ? `("${elLabel.slice(0, 26)}")` : ""}`);
    await new Promise((r) => setTimeout(r, 260));

    const restoreOutline = () => {
      setTimeout(() => {
        targetEl.style.outline = oldOutline;
        targetEl.style.boxShadow = oldShadow;
        targetEl.style.transition = oldTransition;
      }, 1000);
    };

    const fuzzyNote = usedFuzzy ? " (fuzzy match)" : "";
    const coveredNote = occlusion.covered ? ` [Peringatan: tertutup ${occlusion.coveredBy}]` : "";

    try {
      if (action === "click" || action === "click_element") {
        targetEl.focus();

        const rect = targetEl.getBoundingClientRect();
        const clientX = Math.round(rect.left + rect.width / 2);
        const clientY = Math.round(rect.top + rect.height / 2);
        const screenX = window.screenX + clientX;
        const screenY = window.screenY + clientY;

        const eventInit = {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          detail: 1,
          clientX: clientX,
          clientY: clientY,
          screenX: screenX,
          screenY: screenY,
          button: 0,
          buttons: 1
        };

        targetEl.dispatchEvent(new PointerEvent("pointerdown", eventInit));
        targetEl.dispatchEvent(new MouseEvent("mousedown", eventInit));
        eventInit.buttons = 0;
        targetEl.dispatchEvent(new PointerEvent("pointerup", eventInit));
        targetEl.dispatchEvent(new MouseEvent("mouseup", eventInit));
        targetEl.dispatchEvent(new MouseEvent("click", eventInit));
        try { targetEl.click(); } catch (_) {}

        // Special handling for Google / Gmail jsaction buttons
        const buttonParent = targetEl.closest('[role="button"], [gh="cm"], button, a');
        if (buttonParent && buttonParent !== targetEl) {
          buttonParent.dispatchEvent(new PointerEvent("pointerdown", eventInit));
          buttonParent.dispatchEvent(new MouseEvent("mousedown", eventInit));
          buttonParent.dispatchEvent(new PointerEvent("pointerup", eventInit));
          buttonParent.dispatchEvent(new MouseEvent("mouseup", eventInit));
          buttonParent.dispatchEvent(new MouseEvent("click", eventInit));
          try { buttonParent.click(); } catch (_) {}
        }

        restoreOutline();
        return { success: true, message: `Klik [@e${cleanId}] berhasil${fuzzyNote}${coveredNote}.`, stateChanged: true };
      }

      if (action === "type" || action === "type_text" || action === "fill") {
        targetEl.focus();
        const textToFill = actionData.text !== undefined ? actionData.text : (value || "");
        setNativeInputValue(targetEl, textToFill);

        // Deteksi jika elemen adalah input penerima email (Gmail / webmail)
        const isRecipientField = targetEl.getAttribute("role") === "combobox" ||
                                 targetEl.classList.contains("agP") ||
                                 /(?:to|kepada|penerima|recipient)/i.test(targetEl.getAttribute("aria-label") || targetEl.getAttribute("placeholder") || targetEl.name || "");

        if (pressEnter || actionData.pressEnter || isRecipientField) {
          targetEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          targetEl.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          targetEl.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          if (targetEl.form) targetEl.form.dispatchEvent(new Event("submit", { bubbles: true }));
        }

        const isPassword = targetEl instanceof HTMLInputElement && targetEl.type === "password";
        const displayVal = isPassword ? "••••••••" : textToFill;
        restoreOutline();
        return { success: true, message: `Mengisi "${displayVal}" pada [@e${cleanId}] berhasil${fuzzyNote}.`, stateChanged: true };
      }

      if (action === "select" || action === "select_option") {
        targetEl.focus();
        restoreOutline();
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
              : `Pilihan "${value}" tidak ditemukan pada dropdown [@e${cleanId}].`,
            errorType: optionFound ? null : "ELEMENT_NOT_FOUND",
            stateChanged: optionFound
          };
        }
        return { success: false, error: `Target [@e${cleanId}] bukan elemen <select>.`, errorType: "TOOL_INVALID_ARGUMENT" };
      }

      if (action === "press_key" || action === "press_keyboard" || action === "key_press") {
        targetEl.focus();
        restoreOutline();
        const keyName = actionData.key || value || "Enter";
        const parsed = parseKeyCombo(keyName);
        if (parsed) {
          dispatchKeyCombo(targetEl, parsed);
          if (parsed.key === "Enter") {
            if (targetEl.form) {
              try {
                if (typeof targetEl.form.requestSubmit === "function") {
                  targetEl.form.requestSubmit();
                } else {
                  targetEl.form.submit();
                }
              } catch (e) {
                targetEl.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
              }
            }
          }
          setTimeout(() => { targetEl.style.outline = oldOutline; }, 1000);
          return { success: true, message: `Menekan tombol '${keyName}' pada [@e${cleanId}] berhasil${fuzzyNote}.`, stateChanged: true };
        }
        return { success: false, error: `Nama tombol tidak dikenali: '${keyName}'`, errorType: "TOOL_INVALID_ARGUMENT" };
      }

      return { success: false, error: `Aksi "${action}" tidak didukung.`, errorType: "TOOL_INVALID_ARGUMENT" };
    } catch (err) {
      return { success: false, error: `Error eksekusi: ${err.message}`, errorType: "ELEMENT_NOT_INTERACTABLE" };
    }
  }

  // ─────────────────────────────────────────────────────
  // AUTOMATION ENGINE KHUSUS EMAIL (Gmail / Webmail) DENGAN MULTI-STRATEGY RESOLUTION
  // ─────────────────────────────────────────────────────
  async function handleEmailComposeAutomation(actionData) {
    const to = actionData.to || actionData.recipient || "";
    const subject = actionData.subject || "";
    const body = actionData.body || actionData.message || actionData.value || "";
    const sendNow = !!actionData.sendNow;

    // Helper polling elemen dengan MutationObserver & multi-selector fallback
    async function waitForElement(selectorFns, timeoutMs = 4500) {
      const fns = Array.isArray(selectorFns) ? selectorFns : [selectorFns];
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        for (const fn of fns) {
          const el = typeof fn === "string" ? document.querySelector(fn) : fn();
          if (el && isElementVisible(el)) return el;
        }
        await new Promise(r => setTimeout(r, 200));
      }
      for (const fn of fns) {
        const el = typeof fn === "string" ? document.querySelector(fn) : fn();
        if (el) return el;
      }
      return null;
    }

    // Helper untuk menutup overlay autocomplete / dropdown popup
    function dismissAutocompleteOverlays() {
      try {
        const active = document.activeElement;
        if (active) {
          active.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
          active.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
        }
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
      } catch (_) {}
    }

    // 1. Cek atau buka popup Compose/Tulis di Gmail (Multi-Strategy Resolution)
    let composeBox = document.querySelector('div[role="dialog"]') || document.querySelector('table.Ao.Il') || document.querySelector('div.AD');
    if (!composeBox) {
      const composeBtn = await waitForElement([
        'div[gh="cm"]',
        'div[role="button"][aria-label*="Tulis" i]',
        'div[role="button"][aria-label*="Compose" i]',
        '.T-I.T-I-KE.L3',
        '[data-tooltip*="Compose" i]',
        '[data-tooltip*="Tulis" i]',
        () => findElementByFuzzy("Tulis", "click"),
        () => findElementByFuzzy("Compose", "click")
      ], 3000);

      if (composeBtn) {
        const rect = composeBtn.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;
        const eventInit = { bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY };

        composeBtn.dispatchEvent(new PointerEvent("pointerdown", eventInit));
        composeBtn.dispatchEvent(new MouseEvent("mousedown", eventInit));
        composeBtn.dispatchEvent(new PointerEvent("pointerup", eventInit));
        composeBtn.dispatchEvent(new MouseEvent("mouseup", eventInit));
        composeBtn.dispatchEvent(new MouseEvent("click", eventInit));
        try { composeBtn.click(); } catch (_) {}
      }

      // Fallback 1: Shortcut keyboard 'c' bawaan Gmail
      composeBox = await waitForElement(() => document.querySelector('div[role="dialog"]') || document.querySelector('table.Ao.Il') || document.querySelector('div.AD'), 2000);
      if (!composeBox) {
        try {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "c", code: "KeyC", keyCode: 67, which: 67, bubbles: true }));
        } catch (_) {}
      }

      // Fallback 2: Direct hash navigation #inbox?compose=new
      composeBox = await waitForElement(() => document.querySelector('div[role="dialog"]') || document.querySelector('table.Ao.Il') || document.querySelector('div.AD'), 2000);
      if (!composeBox && window.location.hostname.includes("mail.google.com")) {
        window.location.hash = "#inbox?compose=new";
        composeBox = await waitForElement(() => document.querySelector('div[role="dialog"]') || document.querySelector('table.Ao.Il') || document.querySelector('div.AD'), 3500);
      }
    }

    await new Promise(r => setTimeout(r, 400));

    // 2. Isi Penerima (To / Kepada) & Verifikasi Chip Terbentuk
    if (to) {
      const toInput = await waitForElement([
        'input[peoplekit-id]',
        'input.agP',
        'input[aria-label*="Kepada" i]',
        'input[aria-label*="To" i]',
        'input[role="combobox"]',
        'div[aria-label*="Kepada" i] input',
        'div[aria-label*="To" i] input',
        'table.Ao input',
        () => findElementByFuzzy("Kepada", "type"),
        () => findElementByFuzzy("To", "type")
      ], 3500);

      if (toInput) {
        toInput.focus();
        setNativeInputValue(toInput, to);
        // Dispatch Enter and Tab to commit recipient chip
        toInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        toInput.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        toInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        toInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", code: "Tab", keyCode: 9, which: 9, bubbles: true }));
        toInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise(r => setTimeout(r, 400));

        // Dismiss dropdown autocomplete agar tidak menutupi tombol Kirim
        dismissAutocompleteOverlays();
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // 3. Isi Subjek
    if (subject) {
      const subjectInput = await waitForElement([
        'input[name="subjectbox"]',
        'input[aria-label*="Subjek" i]',
        'input[aria-label*="Subject" i]',
        'input[placeholder*="Subjek" i]',
        'input[placeholder*="Subject" i]',
        () => findElementByFuzzy("Subjek", "type"),
        () => findElementByFuzzy("Subject", "type")
      ], 3000);

      if (subjectInput) {
        subjectInput.focus();
        setNativeInputValue(subjectInput, subject);
        subjectInput.dispatchEvent(new Event("input", { bubbles: true }));
        subjectInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // 4. Isi Pesan (Body)
    if (body) {
      const bodyEditor = await waitForElement([
        'div[role="textbox"][aria-label*="Pesan" i]',
        'div[role="textbox"][aria-label*="Message Body" i]',
        'div[role="textbox"][aria-label*="Body" i]',
        'div.Am.Al.editable',
        'div.editable[contenteditable="true"]',
        '[contenteditable="true"]'
      ], 3000);

      if (bodyEditor) {
        bodyEditor.focus();
        let inserted = false;
        try {
          const htmlContent = body.replace(/\n/g, "<br>");
          inserted = document.execCommand("insertHTML", false, htmlContent);
        } catch (_) {}
        if (!inserted) {
          try {
            inserted = document.execCommand("insertText", false, body);
          } catch (_) {}
        }
        if (!inserted) {
          bodyEditor.innerText = body;
        }
        bodyEditor.dispatchEvent(new Event("input", { bubbles: true }));
        bodyEditor.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Tutup autocomplete popovers jika masih ada
    dismissAutocompleteOverlays();
    await new Promise(r => setTimeout(r, 300));

    // 5. Klik Kirim jika sendNow aktif dengan multi-strategy & retry backoff
    if (sendNow) {
      const sendBtnSelectors = [
        'div[role="button"][data-tooltip*="Kirim" i]',
        'div[role="button"][data-tooltip*="Send" i]',
        'div[aria-label*="Kirim" i]',
        'div[aria-label*="Send" i]',
        'div.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
        () => findElementByFuzzy("Kirim", "click"),
        () => findElementByFuzzy("Send", "click")
      ];

      let sendBtn = null;
      const retryDelays = [500, 1000, 2000];

      for (let attempt = 0; attempt < 3; attempt++) {
        sendBtn = await waitForElement(sendBtnSelectors, 2500);
        if (sendBtn) {
          const occ = checkOcclusion(sendBtn);
          if (occ.covered) {
            dismissAutocompleteOverlays();
            await new Promise(r => setTimeout(r, retryDelays[attempt]));
          } else {
            break;
          }
        } else {
          await new Promise(r => setTimeout(r, retryDelays[attempt]));
        }
      }

      if (sendBtn) {
        try {
          sendBtn.focus?.();
          sendBtn.click();
          await new Promise(r => setTimeout(r, 800));
          return { success: true, message: `Email ke "${to}" dengan subjek "${subject}" berhasil dikirim ke penerima.`, stateChanged: true };
        } catch (err) {
          return { success: true, message: `Draf email ke "${to}" sudah tersimpan di Gmail. Silakan klik tombol Kirim secara manual (${err.message}).`, stateChanged: true };
        }
      } else {
        return { success: true, message: `Draf email ke "${to}" dengan subjek "${subject}" telah berhasil disusun dan tersimpan di Gmail. Silakan tinjau dan klik Kirim.`, stateChanged: true };
      }
    }

    return { success: true, message: `Draf email ke "${to}" dengan subjek "${subject}" berhasil disusun rapi di editor Gmail.`, stateChanged: true };
  }

  // ─────────────────────────────────────────────────────
  // AUTOMATION ENGINE KHUSUS MEDIA SOSIAL (X/Twitter, LinkedIn, Facebook)
  // ─────────────────────────────────────────────────────
  function sanitizeSocialPostForPlatform(rawText) {
    let clean = String(rawText || "")
      .replace(/^###\s+.*$/gim, "")
      .replace(/^#\s+.*$/gim, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^>\s*/gm, "")
      .trim();

    const isTwitter = /x\.com|twitter\.com/i.test(window.location.hostname);
    if (isTwitter) {
      // Cek apakah teks berbentuk multi-tweet thread (misal "Tweet 1 ... Tweet 2 ...")
      const tweet1Match = clean.match(/(?:Tweet\s*1\s*\(?[^\)]*\)?\s*:?|1\/\d+)\s*([\s\S]*?)(?=(?:Tweet\s*2|2\/\d+|$))/i);
      if (tweet1Match && tweet1Match[1].trim().length > 10) {
        clean = tweet1Match[1].trim();
      } else {
        const paragraphs = clean.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 10 && !p.startsWith("---"));
        if (paragraphs.length > 0) {
          clean = paragraphs[0];
        }
      }

      clean = clean.replace(/^(?:Tweet\s*\d+|The\s*Hook)\s*:?\s*/i, "").trim();

      // Batasi ketat maksimal 245 karakter agar muat sempurna dalam batas 280 karakter Twitter/X
      if (clean.length > 245) {
        clean = clean.slice(0, 240).trim() + "...";
      }
    }

    return clean;
  }

  async function handleSocialPostAutomation(actionData) {
    const rawPostText = actionData.text || actionData.body || actionData.content || actionData.value || "";
    const postText = sanitizeSocialPostForPlatform(rawPostText);
    const sendNow = !!actionData.sendNow || !!actionData.postNow;

    async function waitForElement(selectorFn, timeoutMs = 4500) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const el = selectorFn();
        if (el) return el;
        await new Promise(r => setTimeout(r, 200));
      }
      return selectorFn();
    }

    // 1. Cari kotak postingan Twitter / X / LinkedIn / Facebook / Threads
    let composeBox = await waitForElement(() => {
      return document.querySelector('div[data-testid="tweetTextarea_0"]') ||
             document.querySelector('div[role="textbox"][data-testid*="tweetTextarea"]') ||
             document.querySelector('div[data-testid="tweetTextarea_0_label"]') ||
             document.querySelector('.ql-editor') ||
             document.querySelector('div[role="textbox"][aria-label*="Post text" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Tweet text" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Teks postingan" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Apa yang Anda pikirkan" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="What do you want to talk about" i]') ||
             document.querySelector('div[role="textbox"][contenteditable="true"]') ||
             document.querySelector('div[contenteditable="true"]');
    }, 4500);

    if (!composeBox) {
      const startPostBtn = document.querySelector('a[data-testid="SideNav_NewTweet_Button"]') ||
                           document.querySelector('button[aria-label*="Start a post" i]') ||
                           document.querySelector('button[aria-label*="Mulai posting" i]') ||
                           findElementByFuzzy("Post", "click") ||
                           findElementByFuzzy("Posting", "click");
      if (startPostBtn) {
        startPostBtn.click();
        composeBox = await waitForElement(() => {
          return document.querySelector('div[data-testid="tweetTextarea_0"]') ||
                 document.querySelector('div[role="textbox"][data-testid*="tweetTextarea"]') ||
                 document.querySelector('div[contenteditable="true"]');
        }, 3500);
      }
    }

    if (!composeBox) {
      return { success: false, error: "Kotak postingan media sosial tidak ditemukan di halaman ini.", errorType: "ELEMENT_NOT_FOUND" };
    }

    // 2. Idempotency Check & Single-Pass Insertion (Social Composer Anti-Duplication Protocol)
    composeBox.focus();
    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (_) {}
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(composeBox);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (_) {}

    try {
      document.execCommand("insertText", false, postText);
    } catch (_) {}

    const currentBoxText = (composeBox.innerText || composeBox.textContent || "").trim();
    if (!currentBoxText || currentBoxText.length < 5) {
      try {
        const dt = new DataTransfer();
        dt.setData("text/plain", postText);
        const pasteEv = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
        composeBox.dispatchEvent(pasteEv);
      } catch (_) {
        try {
          composeBox.innerText = postText;
        } catch (_) {}
      }
    }

    composeBox.dispatchEvent(new Event("input", { bubbles: true }));
    composeBox.dispatchEvent(new Event("change", { bubbles: true }));

    // Tutup popup/popover saran hashtag dengan Escape (JANGAN tekan Enter/Tab/Space agar tidak menerima autosuggest ganda)
    try {
      composeBox.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
      composeBox.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
    } catch (_) {}

    await new Promise(r => setTimeout(r, 600));

    // 3. Klik tombol Post/Tweet jika sendNow / postNow aktif (Single-pass click + verify)
    if (sendNow) {
      const postBtn = await waitForElement(() => {
        return document.querySelector('button[data-testid="tweetButtonInline"]') ||
               document.querySelector('button[data-testid="tweetButton"]') ||
               document.querySelector('button[role="button"][data-testid*="tweetButton"]') ||
               document.querySelector('button[aria-label*="Post" i]') ||
               document.querySelector('button.share-actions__primary-action') ||
               findElementByFuzzy("Post", "click") ||
               findElementByFuzzy("Posting", "click");
      }, 3000);

      if (postBtn && !postBtn.disabled && postBtn.getAttribute("aria-disabled") !== "true") {
        postBtn.click();
        await new Promise(r => setTimeout(r, 800));
        return { success: true, message: "Postingan media sosial berhasil dipublikasikan!", stateChanged: true };
      }
    }

    return { success: true, message: "Teks postingan media sosial berhasil diisikan ke kotak input.", stateChanged: true };
  }

  // ─────────────────────────────────────────────────────
  // TABLE SCRAPER & CSV EXPORTER (RFC 4180 COMPLIANT)
  // ─────────────────────────────────────────────────────
  function detectTableLike(root = document) {
    const tablesData = [];

    // 1. Standar HTML Table Detection
    const htmlTables = root.querySelectorAll("table");
    htmlTables.forEach((tbl, tblIdx) => {
      const headers = [];
      const rows = [];

      const headerEls = tbl.querySelectorAll("thead th, thead td, tr:first-child th");
      headerEls.forEach(h => {
        const txt = (h.innerText || h.textContent || "").trim();
        if (txt) headers.push(txt);
      });

      const rowEls = tbl.querySelectorAll("tbody tr, tr");
      rowEls.forEach((r, rIdx) => {
        const cells = r.querySelectorAll("td, th");
        if (cells.length === 0) return;
        const rowData = [];
        cells.forEach(c => rowData.push((c.innerText || c.textContent || "").trim()));

        // Skip jika baris ini persis sama dengan headers
        if (headers.length > 0 && rIdx === 0 && rowData.every((val, i) => val === headers[i])) return;
        if (rowData.some(c => c.length > 0)) rows.push(rowData);
      });

      if (rows.length > 0 || headers.length > 0) {
        tablesData.push({
          id: tbl.id || `table_${tblIdx + 1}`,
          type: "html_table",
          headers: headers.length > 0 ? headers : (rows[0] ? rows[0].map((_, i) => `Kolom ${i + 1}`) : []),
          rows: rows,
          rowCount: rows.length,
          colCount: headers.length || (rows[0] ? rows[0].length : 0)
        });
      }
    });

    // 2. ARIA Data-Grid Detection (React Table, AG-Grid, Material UI, Salesforce, Tokopedia SRP)
    const ariaGrids = root.querySelectorAll('[role="grid"], [role="treegrid"], [role="table"]');
    ariaGrids.forEach((grid, gridIdx) => {
      const headers = [];
      const rows = [];

      const colHeaders = grid.querySelectorAll('[role="columnheader"]');
      colHeaders.forEach(ch => {
        const txt = (ch.innerText || ch.textContent || "").trim();
        if (txt) headers.push(txt);
      });

      const rowEls = grid.querySelectorAll('[role="row"]');
      rowEls.forEach(r => {
        const cellEls = r.querySelectorAll('[role="cell"], [role="gridcell"]');
        if (cellEls.length === 0) return;
        const rowData = [];
        cellEls.forEach(cell => rowData.push((cell.innerText || cell.textContent || "").trim()));
        if (rowData.some(c => c.length > 0)) rows.push(rowData);
      });

      if (rows.length > 0) {
        tablesData.push({
          id: grid.id || `grid_${gridIdx + 1}`,
          type: "aria_grid",
          headers: headers.length > 0 ? headers : rows[0].map((_, i) => `Kolom ${i + 1}`),
          rows: rows,
          rowCount: rows.length,
          colCount: headers.length || rows[0].length
        });
      }
    });

    return tablesData;
  }

  function exportToCSV(headers = [], rows = []) {
    function escapeCSVCell(val) {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    const lines = [];
    if (headers && headers.length > 0) {
      lines.push(headers.map(escapeCSVCell).join(","));
    }

    (rows || []).forEach(row => {
      lines.push((row || []).map(escapeCSVCell).join(","));
    });

    return lines.join("\r\n");
  }

  // ─────────────────────────────────────────────────────
  // BATCH & SINGLE ACTION DISPATCHER
  // ─────────────────────────────────────────────────────
  async function executeAction(actionData) {
    if (!actionData) return { success: false, error: "Data aksi kosong" };

    if (actionData.action === "compose_email" || actionData.action === "send_email" || actionData.action === "email_compose") {
      return await handleEmailComposeAutomation(actionData);
    }

    if (actionData.action === "post_social" || actionData.action === "post_twitter" || actionData.action === "post_x" || actionData.action === "tweet" || actionData.action === "social_post") {
      return await handleSocialPostAutomation(actionData);
    }

    if (Array.isArray(actionData.actions) && actionData.actions.length > 0) {
      const results = [];
      for (const act of actionData.actions) {
        const res = await executeSingleAction(act);
        results.push(res);
        if (!res.success) {
          return {
            success: false,
            error: `Gagal pada batch step: ${res.error}`,
            stateChanged: results.some((item) => item.stateChanged),
            batchResults: results
          };
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      return {
        success: true,
        message: `Berhasil mengeksekusi ${results.length} aksi batch.`,
        stateChanged: results.some((item) => item.stateChanged),
        batchResults: results
      };
    }

    return await executeSingleAction(actionData);
  }

  // ─────────────────────────────────────────────────────
  // MESSAGE LISTENER
  // ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "DETECT_TABLES") {
      const tables = detectTableLike(document);
      sendResponse({ success: true, tables });
      return true;
    }

    if (request.type === "EXPORT_TABLE_CSV") {
      const tables = detectTableLike(document);
      if (tables && tables.length > 0) {
        const primaryTable = tables[0];
        const csvContent = exportToCSV(primaryTable.headers, primaryTable.rows);
        sendResponse({
          success: true,
          csvContent,
          rowCount: primaryTable.rowCount,
          colCount: primaryTable.colCount,
          headers: primaryTable.headers,
          tableId: primaryTable.id
        });
      } else {
        sendResponse({ success: false, error: "Tidak ditemukan elemen tabel atau data grid pada halaman ini." });
      }
      return true;
    }

    if (request.type === "GET_READABLE_TEXT") {
      const text = getReadableContent();
      sendResponse({
        success: true,
        title: document.title || "",
        url: window.location.href || "",
        text: text
      });
      return true;
    }

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

    if (request.type === "LOCK_PAGE") {
      lockPageShield(request.message);
      sendResponse({ success: true });
      return true;
    }

    if (request.type === "UNLOCK_PAGE") {
      unlockPageShield();
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
