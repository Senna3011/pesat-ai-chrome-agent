// content.js - Computer-Use Grade Semantic AXTree Scanner & Robust Action Engine (v5.0)
// Fitur: AXTree snapshot, colored bounding box, occlusion detection, auto-wait,
// fuzzy fallback, React/Vue setter, key_combo, hover, drag, upload_file,
// paste_text (Google Docs/canvas friendly), click_coords (vision grounding).

(() => {
  if (window.__PESAT_CONTENT_SCRIPT_INITIALIZED__) {
    return;
  }
  window.__PESAT_CONTENT_SCRIPT_INITIALIZED__ = true;

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
      parseFloat(style.opacity) < 0.05
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;

    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    return rect.top <= vh + 150 && rect.bottom >= -150 && rect.left <= vw + 150 && rect.right >= -150;
  }

  function isElementInViewport(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    return rect.top >= 0 && rect.bottom <= vh && rect.left >= 0 && rect.right <= vw;
  }

  // Traversal rekursif Shadow DOM untuk menemukan elemen di dalam Web Components
  function collectElementsDeep(selector, root = document) {
    const results = [];
    try {
      results.push(...Array.from(root.querySelectorAll(selector)));
    } catch (_) {}

    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
          if (node.id === "pesat-ai-agent-host-root" || node.tagName?.toLowerCase() === "pesat-ai-agent-host") {
            return NodeFilter.FILTER_REJECT;
          }
          return node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      let host;
      while ((host = walker.nextNode())) {
        if (host.shadowRoot && host.id !== "pesat-ai-agent-host-root") {
          results.push(...collectElementsDeep(selector, host.shadowRoot));
        }
      }
    } catch (_) {}

    return results;
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
    if (tag === "a") return "link";
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
    if (el.closest?.("nav, aside, [class*='sidebar' i], [class*='menu' i], [role='navigation']")) return "menuitem";

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
  // SHADOW DOM ISOLATED HOST & STYLES (Zero CSS Collision)
  // ─────────────────────────────────────────────────────
  let pesatHostElement = null;
  let pesatShadowRoot = null;

  function getOrCreatePesatShadowRoot() {
    // 1. Cek dan hapus duplikat pesat-ai-agent-host yang mungkin ada di DOM
    const existingHosts = Array.from(document.querySelectorAll("pesat-ai-agent-host, #pesat-ai-agent-host-root"));
    if (existingHosts.length > 0) {
      const primaryHost = existingHosts[0];
      for (let i = 1; i < existingHosts.length; i++) {
        try { existingHosts[i].remove(); } catch (_) {}
      }
      if (primaryHost.shadowRoot) {
        pesatHostElement = primaryHost;
        pesatShadowRoot = primaryHost.shadowRoot;
        ensurePesatStylesInShadow(pesatShadowRoot);
        return pesatShadowRoot;
      }
      try { primaryHost.remove(); } catch (_) {}
    }

    if (pesatShadowRoot && pesatHostElement && (document.documentElement.contains(pesatHostElement) || document.body?.contains(pesatHostElement))) {
      return pesatShadowRoot;
    }

    if (pesatHostElement) {
      try { pesatHostElement.remove(); } catch (_) {}
    }

    pesatHostElement = document.createElement("pesat-ai-agent-host");
    pesatHostElement.id = "pesat-ai-agent-host-root";
    pesatHostElement.style.cssText = `
      all: initial !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 0 !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    `;

    pesatShadowRoot = pesatHostElement.attachShadow({ mode: "open" });
    ensurePesatStylesInShadow(pesatShadowRoot);

    (document.body || document.documentElement).appendChild(pesatHostElement);
    return pesatShadowRoot;
  }

  function ensurePesatStylesInShadow(root) {
    if (!root || root.querySelector("#pesat-reading-visual-styles")) return;
    const style = document.createElement("style");
    style.id = "pesat-reading-visual-styles";
    style.textContent = `
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
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
      #pesat-fab-toggle {
        position: fixed !important;
        bottom: 24px;
        right: 24px;
        width: 48px !important;
        height: 48px !important;
        border-radius: 50% !important;
        background: #0f172a !important;
        border: 2px solid #38bdf8 !important;
        color: #38bdf8 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.4) !important;
        cursor: grab !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        touch-action: none !important;
        transition: transform 0.15s, box-shadow 0.15s !important;
      }
      #pesat-fab-toggle:hover {
        transform: scale(1.08) !important;
        box-shadow: 0 6px 24px rgba(56, 189, 248, 0.6) !important;
      }
      #pesat-fab-toggle:active {
        cursor: grabbing !important;
        transform: scale(0.96) !important;
      }
      #pesat-selection-toolbar {
        position: absolute !important;
        display: none;
        background: #0f172a !important;
        border: 1px solid rgba(56, 189, 248, 0.5) !important;
        border-radius: 8px !important;
        padding: 4px !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        gap: 4px !important;
        align-items: center !important;
      }
      .pesat-tb-btn {
        background: #1e293b !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        color: #f8fafc !important;
        padding: 5px 9px !important;
        border-radius: 6px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        transition: background 0.15s !important;
      }
      .pesat-tb-btn:hover {
        background: #334155 !important;
        color: #38bdf8 !important;
      }
      .pesat-tb-ask {
        background: #0284c7 !important;
        color: #ffffff !important;
        border-color: #38bdf8 !important;
      }
      .pesat-tb-ask:hover {
        background: #0369a1 !important;
      }
      #pesat-selection-popover {
        position: absolute !important;
        display: none;
        width: 360px !important;
        max-width: 90vw !important;
        background: #0f172a !important;
        border: 1px solid #38bdf8 !important;
        border-radius: 10px !important;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7) !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        overflow: hidden !important;
        font-size: 14px !important;
      }
      .pesat-popover-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        background: #1e293b !important;
        padding: 8px 12px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
      .pesat-popover-title {
        font-weight: 600 !important;
        color: #38bdf8 !important;
        font-size: 13px !important;
      }
      .pesat-popover-actions {
        display: flex !important;
        gap: 6px !important;
      }
      .pesat-popover-copy, .pesat-popover-close {
        background: #334155 !important;
        border: none !important;
        color: #f8fafc !important;
        padding: 3px 8px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        cursor: pointer !important;
      }
      .pesat-popover-close:hover {
        background: #ef4444 !important;
      }
      .pesat-popover-body {
        padding: 12px !important;
        max-height: 280px !important;
        overflow-y: auto !important;
        color: #f1f5f9 !important;
        line-height: 1.5 !important;
        font-size: 13.5px !important;
      }
      .pesat-popover-loading {
        color: #94a3b8 !important;
        font-style: italic !important;
      }
      #pesat-search-copilot {
        position: fixed !important;
        top: 130px;
        right: 24px;
        width: 360px !important;
        max-width: calc(100vw - 48px) !important;
        max-height: 75vh !important;
        background: #0b0f19 !important;
        border: 1px solid rgba(56, 189, 248, 0.4) !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(56, 189, 248, 0.2) !important;
        z-index: 2147483646 !important;
        pointer-events: auto !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }
      .pesat-copilot-header {
        background: #111827 !important;
        padding: 10px 14px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        cursor: grab !important;
        user-select: none !important;
      }
      .pesat-copilot-header:active {
        cursor: grabbing !important;
      }
      .pesat-copilot-title-row {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
      }
      .pesat-copilot-badge {
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 0.05em !important;
        color: #38bdf8 !important;
      }
      .pesat-copilot-controls {
        display: flex !important;
        gap: 6px !important;
        align-items: center !important;
      }
      .pesat-copilot-minimize,
      .pesat-copilot-close {
        background: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        color: #cbd5e1 !important;
        cursor: pointer !important;
        font-size: 13px !important;
        width: 26px !important;
        height: 26px !important;
        border-radius: 6px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
        pointer-events: auto !important;
        transition: all 0.15s !important;
      }
      .pesat-copilot-minimize:hover {
        background: rgba(56, 189, 248, 0.2) !important;
        color: #38bdf8 !important;
        border-color: #38bdf8 !important;
      }
      .pesat-copilot-close:hover {
        background: #ef4444 !important;
        color: #ffffff !important;
        border-color: #ef4444 !important;
      }
      #pesat-search-copilot.pesat-copilot-minimized {
        height: auto !important;
        max-height: 48px !important;
        width: 230px !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6) !important;
      }
      #pesat-search-copilot.pesat-copilot-minimized .pesat-copilot-query,
      #pesat-search-copilot.pesat-copilot-minimized .pesat-copilot-body,
      #pesat-search-copilot.pesat-copilot-minimized .pesat-copilot-footer {
        display: none !important;
      }
      .pesat-copilot-query {
        font-size: 13px !important;
        font-weight: 600 !important;
        color: #f8fafc !important;
        margin-top: 4px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      .pesat-copilot-body {
        padding: 12px !important;
        overflow-y: auto !important;
        color: #e2e8f0 !important;
        font-size: 13.5px !important;
        line-height: 1.55 !important;
        flex: 1 !important;
      }
      .pesat-copilot-content {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 13.5px !important;
        line-height: 1.6 !important;
        color: #cbd5e1 !important;
      }
      .pesat-copilot-content p {
        margin: 0 0 8px 0 !important;
        color: #f1f5f9 !important;
      }
      .pesat-copilot-content strong {
        color: #38bdf8 !important;
        font-weight: 600 !important;
      }
      .pesat-copilot-content em {
        color: #cbd5e1 !important;
        font-style: italic !important;
      }
      .pesat-copilot-content ul {
        margin: 4px 0 8px 0 !important;
        padding-left: 18px !important;
      }
      .pesat-copilot-content ol {
        margin: 4px 0 8px 0 !important;
        padding-left: 20px !important;
      }
      .pesat-copilot-content li {
        margin-bottom: 6px !important;
        color: #e2e8f0 !important;
        line-height: 1.5 !important;
      }
      .pesat-copilot-content h1,
      .pesat-copilot-content h2,
      .pesat-copilot-content h3 {
        color: #f8fafc !important;
        font-size: 14.5px !important;
        font-weight: 700 !important;
        margin: 8px 0 6px 0 !important;
      }
      .pesat-popover-content {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 13.5px !important;
        line-height: 1.6 !important;
        color: #cbd5e1 !important;
      }
      .pesat-popover-content p {
        margin: 0 0 6px 0 !important;
        color: #f1f5f9 !important;
      }
      .pesat-popover-content strong {
        color: #38bdf8 !important;
        font-weight: 600 !important;
      }
      .pesat-popover-content ul, .pesat-popover-content ol {
        margin: 4px 0 6px 0 !important;
        padding-left: 18px !important;
      }
      .pesat-popover-content li {
        margin-bottom: 4px !important;
        color: #e2e8f0 !important;
      }
      .pesat-copilot-footer {
        display: flex !important;
        gap: 8px !important;
        padding: 10px 14px !important;
        background: #0f172a !important;
        border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
      .pesat-copilot-btn {
        flex: 1 !important;
        background: #1e293b !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        color: #f8fafc !important;
        padding: 6px 10px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: background 0.15s !important;
      }
      .pesat-copilot-sidepanel {
        background: #0284c7 !important;
        border-color: #38bdf8 !important;
      }
    `;
    root.appendChild(style);
  }

  function triggerScanningBeam() {
    // Muted to eliminate distracting visual laser sweeps across the webpage
    return;
  }

  let pesatHudTimer = null;
  function showReadingHUD(text, isComplete = false) {
    const root = getOrCreatePesatShadowRoot();
    let hud = root.querySelector("#pesat-reading-hud");
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "pesat-reading-hud";
      root.appendChild(hud);
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
      font-size: 14px;
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
    hud.replaceChildren();

    const dot = document.createElement("span");
    dot.style.cssText = `width: 7px; height: 7px; border-radius: 50%; background: ${dotColor}; box-shadow: 0 0 8px ${dotColor}; animation: pesatRadarPulse 1.2s infinite; flex-shrink: 0;`;

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    hud.appendChild(dot);
    hud.appendChild(textSpan);

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
    const root = getOrCreatePesatShadowRoot();
    const existing = root.querySelector("#pesat-markers-legend");
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

    const header = document.createElement("div");
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;";

    const titleSpan = document.createElement("span");
    titleSpan.style.cssText = "font-size:14px; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:5px;";
    titleSpan.textContent = "⚡ Petunjuk Marker AI (#ID)";

    const closeBtn = document.createElement("button");
    closeBtn.id = "pesat-btn-close-legend";
    closeBtn.style.cssText = "background:none; border:none; color:#94a3b8; font-size:14px; cursor:pointer; padding:0 4px;";
    closeBtn.title = "Tutup";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => {
      legend.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      legend.style.opacity = "0";
      legend.style.transform = "translateY(8px)";
      setTimeout(() => legend.remove(), 220);
    });

    header.appendChild(titleSpan);
    header.appendChild(closeBtn);
    legend.appendChild(header);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:14px; color:#cbd5e1;";

    const legendItems = [
      { color: "#1d4ed8", text: "📝 Input / Form" },
      { color: "#b91c1c", text: "🔘 Tombol" },
      { color: "#047857", text: "🔗 Menu / Link" },
      { color: "#b45309", text: "📋 Dropdown" }
    ];

    legendItems.forEach(item => {
      const itemDiv = document.createElement("div");
      itemDiv.style.cssText = "display:flex; align-items:center; gap:5px;";

      const colorBox = document.createElement("span");
      colorBox.style.cssText = `width:10px; height:10px; border-radius:2px; background:${item.color}; display:inline-block; flex-shrink:0;`;

      const labelSpan = document.createElement("span");
      labelSpan.textContent = item.text;

      itemDiv.appendChild(colorBox);
      itemDiv.appendChild(labelSpan);
      grid.appendChild(itemDiv);
    });

    legend.appendChild(grid);

    const footer = document.createElement("div");
    footer.style.cssText = "font-size:14px; color:#94a3b8; margin-top:8px; border-top:1px solid rgba(255,255,255,0.08); padding-top:6px; line-height:1.3;";
    footer.textContent = "💡 Nomor (#1, #2...) adalah ID tombol/input yang sedang dibaca dan dikontrol AI.";
    legend.appendChild(footer);

    root.appendChild(legend);
  }

  function clearVisualMarkers() {
    const root = getOrCreatePesatShadowRoot();
    if (markersOverlay) {
      const mo = markersOverlay;
      markersOverlay = null;
      mo.style.transition = "opacity 0.25s ease";
      mo.style.opacity = "0";
      setTimeout(() => { if (mo.parentNode) mo.remove(); }, 260);
    }
    const legend = root.querySelector("#pesat-markers-legend");
    if (legend) {
      legend.style.transition = "opacity 0.25s ease, transform 0.25s ease";
      legend.style.opacity = "0";
      legend.style.transform = "translateY(8px)";
      setTimeout(() => { if (legend.parentNode) legend.remove(); }, 260);
    }
    const hud = root.querySelector("#pesat-reading-hud");
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
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    if (path.some(el => el && el.id === "pesat-shield-unlock-btn")) {
      return;
    }
    if (e.target && (e.target.id === "pesat-shield-unlock-btn" || e.target.closest?.("#pesat-shield-unlock-btn"))) {
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
    const root = getOrCreatePesatShadowRoot();
    const existing = root.querySelector("#pesat-page-lock-shield");
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

    const badgeContainer = document.createElement("div");
    badgeContainer.style.cssText = "display: flex; align-items: center; gap: 10px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(99, 102, 241, 0.45); box-shadow: 0 12px 32px rgba(0,0,0,0.65), 0 0 16px rgba(99, 102, 241, 0.2); padding: 8px 16px; border-radius: 9999px; color: #f8fafc; font-size: 14px; font-weight: 500; pointer-events: auto; cursor: default; animation: pesatShieldPulse 1.8s infinite alternate;";

    const dot = document.createElement("span");
    dot.style.cssText = "width: 8px; height: 8px; border-radius: 50%; background: #6366f1; box-shadow: 0 0 8px #6366f1; flex-shrink: 0;";

    const msgSpan = document.createElement("span");
    msgSpan.id = "pesat-shield-msg";
    msgSpan.style.cssText = "color: #f1f5f9;";
    msgSpan.textContent = message;

    const unlockBtn = document.createElement("button");
    unlockBtn.id = "pesat-shield-unlock-btn";
    unlockBtn.style.cssText = "background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 6px; padding: 4px 10px; font-size: 14px; cursor: pointer; margin-left: 4px; transition: background 0.15s;";
    unlockBtn.title = "Buka kunci halaman manual";
    unlockBtn.textContent = "Buka Kunci";

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

    badgeContainer.appendChild(dot);
    badgeContainer.appendChild(msgSpan);
    badgeContainer.appendChild(unlockBtn);
    pageLockShield.appendChild(badgeContainer);

    root.appendChild(pageLockShield);

    BLOCK_EVENT_TYPES.forEach(type => {
      window.addEventListener(type, blockUserInteractionEvent, { capture: true, passive: false });
    });
  }

  function unlockPageShield() {
    BLOCK_EVENT_TYPES.forEach(type => {
      window.removeEventListener(type, blockUserInteractionEvent, { capture: true, passive: false });
    });

    const root = getOrCreatePesatShadowRoot();
    const shield = root.querySelector("#pesat-page-lock-shield") || pageLockShield;
    if (shield) {
      shield.style.opacity = "0";
      setTimeout(() => { if (shield.parentNode) shield.remove(); }, 200);
    }
    pageLockShield = null;
  }

  // ─────────────────────────────────────────────────────
  // DLP SENSITIVE DATA MASKING (Luhn Card & NIK Protection)
  // ─────────────────────────────────────────────────────
  function isValidLuhn(digits) {
    let sum = 0;
    let alternate = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits.charAt(i), 10);
      if (alternate) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 === 0;
  }

  function maskSensitiveDLP(text) {
    if (!text || typeof text !== "string") return text;
    return text.replace(/\b(?:\d{4}[ -]?){3}\d{1,7}\b|\b\d{13,19}\b/g, (match) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 13 && digits.length <= 19 && isValidLuhn(digits)) {
        return "[PROTECTED_CARD]";
      }
      if (digits.length === 16) {
        return "[PROTECTED_ID]";
      }
      return match;
    });
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
      // Routine scans are silent to prevent distracting HUD notifications on the user web page
    }

    const selector = [
      "a",
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
      "[role='treeitem']",
      "[role='option']",
      "[tabindex='0']",
      "[contenteditable='true']",
      "[gh='cm']",
      "summary",
      // Elemen menu navigasi / sidebar non-tombol (dashboard admin & SPA)
      "nav li",
      "aside li",
      "[class*='sidebar' i] li",
      "[class*='sidebar' i] a",
      "[class*='sidebar-item' i]",
      "[class*='sidebar-link' i]",
      "[class*='menu-item' i]",
      "[class*='menu-link' i]",
      "[class*='nav-item' i]",
      "[class*='nav-link' i]",
      "[data-sidebar]",
      "[data-menu]",
      "[data-menu-item]",
      "[onclick]"
    ].join(", ");

    const rawCandidates = collectElementsDeep(selector, document);
    const seenElements = new Set();
    const candidateSet = new Set(rawCandidates);
    let candidateElements = [];

    for (const el of rawCandidates) {
      if (seenElements.has(el)) continue;
      seenElements.add(el);

      const tag = el.tagName.toLowerCase();
      if (tag === "li" || tag === "ul" || tag === "div") {
        const childClickable = el.querySelector("button, a, [role='button'], [role='menuitem']");
        if (childClickable && candidateSet.has(childClickable)) {
          continue; // Prioritaskan elemen anak yang lebih spesifik
        }
      }
      candidateElements.push(el);
    }

    // Prioritaskan elemen di dalam dialog/modal aktif (misal dialog Compose Gmail atau popup form) di urutan pertama
    const activeDialog = document.querySelector('div[role="dialog"]') || document.querySelector('[aria-modal="true"]') || document.querySelector('.modal.show') || document.querySelector('table.Ao.Il');
    if (activeDialog) {
      const dialogEls = candidateElements.filter(el => activeDialog.contains(el));
      const outsideEls = candidateElements.filter(el => !activeDialog.contains(el));
      candidateElements = [...dialogEls, ...outsideEls];
    }

    const visibleElements = candidateElements.filter(isElementVisible);

    // Dynamic viewport prioritization: elemen yang saat ini tampak di viewport diproses terlebih dahulu
    visibleElements.sort((a, b) => {
      const aInView = isElementInViewport(a) ? 1 : 0;
      const bInView = isElementInViewport(b) ? 1 : 0;
      return bInView - aInView;
    });

    if (!showOverlay) {
      clearVisualMarkers();
    } else if (visibleElements.length > 0) {
      const root = getOrCreatePesatShadowRoot();
      markersOverlay = document.createElement("div");
      markersOverlay.id = "pesat-markers-overlay";
      markersOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: ${Math.max(document.body ? document.body.scrollHeight : 0, document.documentElement.scrollHeight)}px;
        pointer-events: none;
        z-index: 2147483640;
        overflow: hidden;
      `;
      root.appendChild(markersOverlay);
      renderFloatingLegend();
    }

    const elementsList = [];
    let idCounter = 1;

    for (const el of visibleElements) {
      if (idCounter > 120) break; // Batas seimbang token & coverage komprehensif

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
          font-size: 14px;
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

    const pageReadableText = maskSensitiveDLP(extractReadablePageText());

    return {
      title: document.title,
      url: window.location.href,
      elementsCount: visibleElements.length,
      reducedDOM: maskSensitiveDLP(elementsList.join("\n")),
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

  function extractYouTubeVideoContext() {
    if (!window.location.hostname.includes("youtube.com") || !window.location.pathname.includes("/watch")) {
      return null;
    }
    const titleEl = document.querySelector("h1.ytd-watch-metadata, #title h1, h1.title");
    const title = titleEl ? titleEl.innerText.trim() : document.title;
    const channelEl = document.querySelector("#channel-name, ytd-channel-name");
    const channel = channelEl ? channelEl.innerText.trim() : "";
    const descEl = document.querySelector("#description-inline-expander, #description");
    const description = descEl ? descEl.innerText.trim().slice(0, 3000) : "";

    const transcriptSegments = document.querySelectorAll("ytd-transcript-segment-renderer");
    let transcriptText = "";
    if (transcriptSegments.length > 0) {
      transcriptText = Array.from(transcriptSegments)
        .map(s => {
          const time = s.querySelector(".segment-timestamp")?.innerText?.trim() || "";
          const text = s.querySelector(".segment-text")?.innerText?.trim() || "";
          return time ? `[${time}] ${text}` : text;
        })
        .join("\n");
    }

    return `[YOUTUBE VIDEO INFORMATION]\nJudul: ${title}\nChannel: ${channel}\n\n[DESKRIPSI VIDEO]:\n${description}\n\n${transcriptText ? `[TRANSKRIP VIDEO]:\n${transcriptText.slice(0, 8000)}` : "(Transkrip otomatis belum dibuka; deskripsi video di atas digunakan sebagai dasar analisis)"}`;
  }

  function getReadableContent(showVisual = true) {
    try {
      if (showVisual) {
        // Keep content extraction silent without laser beam or HUD spam
      }

      // Prioritas 0: Jika di halaman video YouTube, ekstrak transkrip/metadata
      const ytData = extractYouTubeVideoContext();
      if (ytData) {
        return ytData;
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

      return maskSensitiveDLP(resultText.substring(0, 7000).trim());
    } catch (err) {
      console.warn("[Pesat] Gagal mengambil readable content:", err);
      return maskSensitiveDLP(document.body ? (document.body.innerText || "").substring(0, 5000) : "");
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
    const rawQ = String(hintText).toLowerCase().replace(/^@e/, "").trim();
    const q = rawQ.replace(/[-_]/g, " ").replace(/\s+/g, " ");

    const clickPoolSelector = [
      "button",
      "a",
      "[role='button']",
      "[role='link']",
      "[role='menuitem']",
      "[role='treeitem']",
      "[role='tab']",
      "[role='option']",
      "input[type='submit']",
      "input[type='button']",
      "summary",
      // Non-button custom menu & sidebar items
      "nav li",
      "aside li",
      "nav a",
      "aside a",
      "[class*='sidebar' i] li",
      "[class*='sidebar' i] a",
      "[class*='sidebar' i] div",
      "[class*='sidebar' i] span",
      "[class*='menu' i] li",
      "[class*='menu' i] a",
      "[class*='menu' i] div",
      "[class*='menu-item' i]",
      "[class*='menu-link' i]",
      "[class*='sidebar-item' i]",
      "[class*='sidebar-link' i]",
      "[class*='nav-item' i]",
      "[class*='nav-link' i]",
      "[data-sidebar]",
      "[data-menu]",
      "[data-menu-item]",
      "[tabindex='0']",
      "[onclick]"
    ].join(", ");

    const pool = action === "click"
      ? collectElementsDeep(clickPoolSelector)
      : collectElementsDeep("input, textarea, select, [contenteditable='true']");

    const scored = pool
      .filter(isElementVisible)
      .map((el) => {
        const candidates = [
          getAccessibleName(el),
          el.innerText || "",
          el.getAttribute("placeholder") || "",
          el.getAttribute("name") || "",
          el.getAttribute("value") || "",
          el.getAttribute("aria-label") || "",
          el.getAttribute("title") || ""
        ].map((s) => s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim());

        const score = candidates.reduce((acc, c) => {
          if (!c) return acc;
          if (c === q || c === rawQ) return acc + 100;
          if (c.includes(q) || (q.length > 3 && q.includes(c))) return acc + 50;
          if (q.includes(c) && c.length > 2) return acc + 25;
          return acc;
        }, 0);

        return { el, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      return scored[0].el;
    }

    // Deep text search fallback: jika menu dibuat dengan elemen generik (misal span atau div di dalam nav/aside)
    if (action === "click") {
      const textElements = collectElementsDeep("nav *, aside *, [class*='sidebar' i] *, [class*='menu' i] *, span, div, li, p");
      for (const el of textElements) {
        if (!isElementVisible(el)) continue;
        const txt = (el.innerText || el.textContent || "").toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
        if (txt === q || txt === rawQ || (txt.length > 2 && q.includes(txt))) {
          const clickable = el.closest("a, button, [role='button'], [role='menuitem'], li, [class*='item' i], [class*='link' i]") || el;
          return clickable;
        }
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────────────
  // RICH TEXT & MARKDOWN SANITIZER UNTUK DOKUMEN WEB
  // ─────────────────────────────────────────────────────
  // RICH DOCUMENT & HTML TABLE FORMATTER (Docs & Rich Editor Support)
  // ─────────────────────────────────────────────────────
  function convertMarkdownToRichDoc(md = "") {
    let raw = String(md || "").trim();

    // 0. Eliminasi total semua simbol blockquote '>' di awal baris
    // Mencegah Google Docs menampilkan karakter '>' pada teks dokumen
    raw = raw.replace(/^[ \t]*>[ \t]*/gm, "");
    raw = raw.replace(/\n\s*---\s*\n/g, "\n\n");

    function cleanTableCellText(text) {
      let s = String(text || "").trim();
      s = s.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
      s = s.replace(/\*\*\*(.*?)\*\*\*/g, "$1");
      s = s.replace(/\*\*(.*?)\*\*/g, "$1");
      s = s.replace(/\*(.*?)\*/g, "$1");
      s = s.replace(/___(.*?)___/g, "$1");
      s = s.replace(/__(.*?)__/g, "$1");
      s = s.replace(/_(.*?)_/g, "$1");
      s = s.replace(/`([^`]+)`/g, "$1");
      s = s.replace(/^\*+|\*+$/g, "").trim();
      return s;
    }

    function formatTableCellHtml(text) {
      let s = String(text || "").trim();
      s = s.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
      s = s.replace(/\*\*\*(.*?)\*\*\*/g, "<b><i>$1</i></b>");
      s = s.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
      s = s.replace(/\*(.*?)\*/g, "<i>$1</i>");
      s = s.replace(/___(.*?)___/g, "<b><i>$1</i></b>");
      s = s.replace(/__(.*?)__/g, "<b>$1</b>");
      s = s.replace(/_(.*?)_/g, "<i>$1</i>");
      s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
      s = s.replace(/(?:^\*+|\*+$)/g, "").trim();
      return s;
    }

    // 2. Convert Markdown Tables to real HTML <table> elements (Google Docs & Word Native Table Conversion)
    const tableRegex = /((?:^[ \t]*\|[^\n]+\|[ \t]*(?:\r?\n|$))+)/gm;
    const tablesHtml = [];
    const cleanPlainTables = [];
    raw = raw.replace(tableRegex, (match) => {
      const lines = match.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith("|") && l.endsWith("|"));
      if (lines.length < 2) return match;

      let headers = [];
      let rows = [];
      let separatorIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (/^\|[-:\s|]+\|$/.test(lines[i])) {
          separatorIndex = i;
          break;
        }
      }
      if (separatorIndex === -1) return match;

      headers = lines[0].slice(1, -1).split("|").map(c => cleanTableCellText(c));
      for (let i = separatorIndex + 1; i < lines.length; i++) {
        const cells = lines[i].slice(1, -1).split("|").map(c => c.trim());
        if (cells.some(c => c.length > 0)) {
          rows.push(cells);
        }
      }

      let tHtml = `<table style="border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; margin: 16px 0; font-family: Arial, sans-serif; font-size: 14px;">\n<thead>\n<tr style="background-color: #f1f5f9;">\n`;
      headers.forEach(h => {
        tHtml += `  <th style="border: 1px solid #cbd5e1; padding: 10px 14px; font-weight: bold; text-align: left; color: #0f172a; background-color: #f1f5f9;">${h}</th>\n`;
      });
      tHtml += `</tr>\n</thead>\n<tbody>\n`;
      rows.forEach((r, idx) => {
        const bg = idx % 2 === 1 ? "background-color: #f8fafc;" : "background-color: #ffffff;";
        tHtml += `<tr style="${bg}">\n`;
        r.forEach(c => {
          tHtml += `  <td style="border: 1px solid #cbd5e1; padding: 10px 14px; color: #1e293b;">${formatTableCellHtml(c)}</td>\n`;
        });
        tHtml += `</tr>\n`;
      });
      tHtml += `</tbody>\n</table>\n`;

      let cleanTable = headers.join("\t") + "\n" + rows.map(r => r.map(cleanTableCellText).join("\t")).join("\n");

      const placeholder = `PESATTABLEPLACEHOLDER${tablesHtml.length}END`;
      tablesHtml.push(tHtml);
      cleanPlainTables.push(cleanTable.trim());
      return "\n\n" + placeholder + "\n\n";
    });

    // 3. Bersihkan Plain Text yang rapi untuk dokumen (Hapus seluruh asterisk markdown bintang dan underscore)
    let cleanPlain = raw
      .replace(/^#{1,6}\s*(?:[📊🏆📋⚡💡📝📌]\s*)?(.*$)/gm, "$1")
      .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/___(.*?)___/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/^>\s*/gm, "")
      .replace(/^\s*[\*\-]\s+/gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    cleanPlainTables.forEach((tPlain, idx) => {
      cleanPlain = cleanPlain.replace(`PESATTABLEPLACEHOLDER${idx}END`, tPlain);
    });

    // 4. HTML Rich Text untuk Clipboard
    let cleanHtml = raw
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*\*(.*?)\*\*\*/gim, '<b><i>$1</i></b>')
      .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*?)\*/gim, '<i>$1</i>')
      .replace(/___(.*?)___/gim, '<b><i>$1</i></b>')
      .replace(/__(.*?)__/gim, '<b>$1</b>')
      .replace(/_(.*?)_/gim, '<i>$1</i>')
      .replace(/^>\s*(.*$)/gim, '<p style="margin:4px 0 4px 12px;color:#334155;">$1</p>')
      .replace(/^\s*[\*\-]\s+(.*$)/gim, '<li>$1</li>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');

    cleanHtml = `<p>${cleanHtml}</p>`;

    // Restore HTML tables
    tablesHtml.forEach((tHtml, idx) => {
      cleanHtml = cleanHtml.replace(new RegExp(`<p>\\s*PESATTABLEPLACEHOLDER${idx}END\\s*<\\/p>`, "g"), tHtml);
      cleanHtml = cleanHtml.replace(new RegExp(`PESATTABLEPLACEHOLDER${idx}END`, "g"), tHtml);
    });

    cleanPlain = cleanPlain.replace(/^[ \t]*>[ \t]*/gm, "");
    cleanHtml = cleanHtml.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, '<p style="margin:4px 0 4px 12px;color:#334155;">$1</p>');

    cleanHtml = `<html><body><!--StartFragment-->${cleanHtml}<!--EndFragment--></body></html>`;

    return { plain: cleanPlain, html: cleanHtml };
  }

  // ─────────────────────────────────────────────────────
  // REACT / VUE COMPATIBLE VALUE SETTER
  // ─────────────────────────────────────────────────────
  function setNativeInputValue(el, value) {
    try {
      el.focus?.();
      el.dispatchEvent(new Event("focus", { bubbles: true }));
    } catch (_) {}

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
    } else if (el instanceof HTMLInputElement || el.tagName === "INPUT") {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) {
        setter.call(el, value);
      } else {
        el.value = value;
      }
    } else if (el instanceof HTMLTextAreaElement || el.tagName === "TEXTAREA") {
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

    try {
      el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: value }));
    } catch (_) {}
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    } catch (_) {}
    try {
      el.blur?.();
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch (_) {}
  }

  // Eksekusi urutan event klik komprehensif (Pointer, Mouse, Native click, & Form submit)
  function triggerFullClickSequence(targetEl) {
    if (!targetEl) return false;
    try {
      targetEl.scrollIntoView?.({ behavior: "auto", block: "center", inline: "center" });
      targetEl.focus?.();
    } catch (_) {}

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
    try { targetEl.click?.(); } catch (_) {}

    // Handling parent clickable jika target klik adalah elemen anak (span teks, ikon SVG di dalam menu sidebar)
    const clickableParent = targetEl.closest?.('a, button, [role="button"], [role="menuitem"], [role="treeitem"], [role="tab"], [gh="cm"], li, [class*="nav" i], [class*="menu" i], [class*="sidebar" i], [class*="item" i], [tabindex], [onclick], [data-to], [data-href]');
    if (clickableParent && clickableParent !== targetEl) {
      clickableParent.dispatchEvent(new PointerEvent("pointerdown", eventInit));
      clickableParent.dispatchEvent(new MouseEvent("mousedown", eventInit));
      clickableParent.dispatchEvent(new PointerEvent("pointerup", eventInit));
      clickableParent.dispatchEvent(new MouseEvent("mouseup", eventInit));
      clickableParent.dispatchEvent(new MouseEvent("click", eventInit));
      try { clickableParent.click?.(); } catch (_) {}
    }

    // Handling child link/button jika target adalah container (li/div menu sidebar)
    const childClickable = targetEl.querySelector?.('a, button, [role="button"], [role="menuitem"]');
    if (childClickable && childClickable !== targetEl) {
      childClickable.dispatchEvent(new PointerEvent("pointerdown", eventInit));
      childClickable.dispatchEvent(new MouseEvent("mousedown", eventInit));
      childClickable.dispatchEvent(new PointerEvent("pointerup", eventInit));
      childClickable.dispatchEvent(new MouseEvent("mouseup", eventInit));
      childClickable.dispatchEvent(new MouseEvent("click", eventInit));
      try { childClickable.click?.(); } catch (_) {}
    }

    // Navigasi fallback jika elemen memiliki tautan href / data-href / data-to
    const hrefVal = targetEl.getAttribute?.("href") || clickableParent?.getAttribute?.("href") || childClickable?.getAttribute?.("href") ||
                    targetEl.getAttribute?.("data-to") || clickableParent?.getAttribute?.("data-to") ||
                    targetEl.getAttribute?.("data-href") || clickableParent?.getAttribute?.("data-href");
    if (hrefVal && typeof hrefVal === "string" && !hrefVal.startsWith("#") && !hrefVal.startsWith("javascript:")) {
      const initialUrl = window.location.href;
      setTimeout(() => {
        try {
          if (window.location.href === initialUrl) {
            if (hrefVal.startsWith("http://") || hrefVal.startsWith("https://")) {
              window.location.href = hrefVal;
            } else if (hrefVal.startsWith("/")) {
              window.location.pathname = hrefVal;
            }
          }
        } catch (_) {}
      }, 300);
    }

    // Form submit fallback untuk form login / autentikasi web
    const formEl = targetEl.closest?.("form") || document.querySelector("form");
    const isSubmitLike = targetEl.type === "submit" || /submit|login|sign\s*in|masuk|kirim/i.test(targetEl.innerText || targetEl.value || targetEl.getAttribute("aria-label") || "");
    if (formEl && isSubmitLike) {
      try {
        if (typeof formEl.requestSubmit === "function") {
          formEl.requestSubmit(targetEl instanceof HTMLButtonElement || targetEl instanceof HTMLInputElement ? targetEl : undefined);
        } else {
          formEl.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
      } catch (_) {}
    }

    return true;
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
        const found = document.querySelector(selector) || collectElementsDeep(selector, document)[0];
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
      const targetUrl = (value || actionData.url || "").trim();
      if (targetUrl && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
        window.location.href = targetUrl;
        return { success: true, message: `Membuka URL: ${targetUrl}`, stateChanged: true };
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

    // ── Dedicated Google Docs Typing & Clipboard Injection Handler ──
    async function handleGoogleDocsTyping(text, actionData = {}) {
      const cleanText = String(text || "").trim();
      if (!cleanText) {
        return { success: false, error: "Teks pengetikan kosong.", errorType: "TOOL_INVALID_ARGUMENT" };
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

      // 1. Klik dan aktifkan canvas/editor Google Docs
      const editorCanvas = document.querySelector(".kix-appview-editor") ||
                           document.querySelector(".kix-canvas-tile-content") ||
                           document.querySelector(".kix-page-paginated") ||
                           document.querySelector(".docs-editor") ||
                           document.querySelector("#docs-editor") ||
                           document.body;
      if (editorCanvas) {
        try {
          editorCanvas.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          editorCanvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          editorCanvas.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          editorCanvas.focus?.();
        } catch (_) {}
      }

      // 2. Focus target iframe / textarea Google Docs
      const iframe = document.querySelector(".docs-texteventtarget-iframe") ||
                     document.querySelector("iframe[class*='texteventtarget']");

      let innerTextarea = null;
      let innerDoc = null;

      if (iframe) {
        try {
          iframe.focus?.();
          if (iframe.contentWindow) {
            iframe.contentWindow.focus?.();
          }
          innerDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (innerDoc) {
            innerTextarea = innerDoc.querySelector("textarea") ||
                            innerDoc.querySelector("[contenteditable='true']") ||
                            innerDoc.body;
            if (innerTextarea) {
              innerTextarea.focus?.();
            }
          }
        } catch (e) {
          iframe.focus?.();
        }
      }

      const targetElement = innerTextarea || document.activeElement || iframe || editorCanvas;

      // Jika mode replace/ganti isi dokumen: pilih seluruh isi dokumen dan bersihkan sebelum menulis
      if (actionData && actionData.replace) {
        try {
          const targetForSelect = innerTextarea || innerDoc || iframe || editorCanvas || document.body;
          targetForSelect.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", keyCode: 65, which: 65, ctrlKey: !isMac, metaKey: isMac, bubbles: true }));
          if (innerDoc) innerDoc.execCommand("selectAll", false, null);
          document.execCommand("selectAll", false, null);

          targetForSelect.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", keyCode: 8, which: 8, bubbles: true }));
          if (innerDoc) innerDoc.execCommand("delete", false, null);
          document.execCommand("delete", false, null);
          await new Promise(r => setTimeout(r, 60));
        } catch (_) {}
      }

      const { plain: cleanPlain, html: cleanHtml } = convertMarkdownToRichDoc(cleanText);

      // 3. Tulis ke Clipboard sistem dengan format HTML & Plain (Mendukung Tabel & Rich Format)
      try {
        if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
          const blobHtml = new Blob([cleanHtml], { type: "text/html" });
          const blobText = new Blob([cleanPlain], { type: "text/plain" });
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": blobHtml,
              "text/plain": blobText
            })
          ]);
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(cleanPlain);
        }
      } catch (clipboardErr) {
        try {
          await navigator.clipboard?.writeText?.(cleanPlain);
        } catch (_) {}
      }

      // 4. Simulasi Keyboard Event Paste (Ctrl+V / Cmd+V)
      const pasteEvent = new KeyboardEvent("keydown", {
        key: "v",
        code: "KeyV",
        keyCode: 86,
        which: 86,
        ctrlKey: !isMac,
        metaKey: isMac,
        bubbles: true,
        cancelable: true
      });

      if (innerTextarea) innerTextarea.dispatchEvent(pasteEvent);
      if (innerDoc) innerDoc.dispatchEvent(pasteEvent);
      if (iframe) iframe.dispatchEvent(pasteEvent);
      if (editorCanvas) editorCanvas.dispatchEvent(pasteEvent);
      document.dispatchEvent(pasteEvent);

      // 5. DataTransfer Clipboard Event (Paste Injection dengan Rich HTML & Plain)
      const dt = new DataTransfer();
      dt.setData("text/plain", cleanPlain);
      dt.setData("text/html", cleanHtml);
      const pasteClipboardEv = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });

      if (innerTextarea) innerTextarea.dispatchEvent(pasteClipboardEv);
      if (innerDoc) innerDoc.dispatchEvent(pasteClipboardEv);
      if (iframe) iframe.dispatchEvent(pasteClipboardEv);
      if (editorCanvas) editorCanvas.dispatchEvent(pasteClipboardEv);
      document.dispatchEvent(pasteClipboardEv);

      // 6. BeforeInput / InputEvent Fallback
      try {
        const beforeInput = new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: cleanPlain
        });
        if (innerTextarea) innerTextarea.dispatchEvent(beforeInput);
        if (innerDoc) innerDoc.dispatchEvent(beforeInput);
        document.dispatchEvent(beforeInput);
      } catch (_) {}

      // 7. ExecCommand Fallback
      try {
        if (innerDoc) innerDoc.execCommand("insertText", false, cleanPlain);
      } catch (_) {}
      try {
        document.execCommand("insertText", false, cleanPlain);
      } catch (_) {}
      try {
        document.execCommand("paste");
      } catch (_) {}

      showReadingHUD(`✓ Konten/Tabel berhasil ditulis ke Google Docs (${cleanPlain.length} karakter)`, true);
      await new Promise((r) => setTimeout(r, 400));
      return {
        success: true,
        message: `Berhasil menulis ${cleanText.length} karakter ke lembar kerja Google Docs.`,
        stateChanged: true
      };
    }

    // ── Dedicated Spreadsheet & Data Grid Table Input Handler ──
    async function handleSpreadsheetGridInput(dataInput, targetElement = null) {
      if (!dataInput) {
        return { success: false, error: "Data tabel / spreadsheet kosong.", errorType: "TOOL_INVALID_ARGUMENT" };
      }

      let rows = [];
      if (Array.isArray(dataInput)) {
        rows = dataInput.map(r => Array.isArray(r) ? r.map(c => String(c ?? "")) : [String(r ?? "")]);
      } else {
        const rawStr = String(dataInput).trim();
        if (rawStr.includes("|")) {
          // Markdown Table Format
          const lines = rawStr.split("\n").map(l => l.trim()).filter(l => l.startsWith("|") && l.endsWith("|"));
          rows = lines
            .filter(l => !/^\|[-:\s|]+\|$/.test(l))
            .map(l => l.slice(1, -1).split("|").map(cell => cell.trim()));
        } else {
          // CSV / TSV / Multiline Format
          const lines = rawStr.split(/\r?\n/);
          rows = lines.map(line => {
            if (line.includes("\t")) return line.split("\t");
            return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, "").trim());
          }).filter(r => r.length > 0 && r.some(c => c !== ""));
        }
      }

      if (rows.length === 0) {
        return { success: false, error: "Tidak ada baris data valid untuk diisikan.", errorType: "TOOL_INVALID_ARGUMENT" };
      }

      const isGoogleSheets = window.location.hostname.includes("docs.google.com") && window.location.pathname.includes("/spreadsheets");
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

      const tsvText = rows.map(r => r.join("\t")).join("\r\n");
      const htmlTable = `<html><body><!--StartFragment--><table>${rows.map(r => `<tr>${r.map(c => `<td>${String(c ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`).join("")}</table><!--EndFragment--></body></html>`;

      // 1. Google Sheets Integration (Waffle Clipboard Engine & Formula Bar Direct Injection)
      if (isGoogleSheets) {
        // Tulis TSV & HTML matriks ke system clipboard agar data tersalin secara global
        if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
          try {
            const blobHtml = new Blob([htmlTable], { type: "text/html" });
            const blobText = new Blob([tsvText], { type: "text/plain" });
            await navigator.clipboard.write([
              new ClipboardItem({
                "text/html": blobHtml,
                "text/plain": blobText
              })
            ]).catch(() => {});
          } catch (_) {}
        } else if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(tsvText).catch(() => {});
          } catch (_) {}
        }

        // 1. Reset posisi kursor ke sel A1 (dan bersihkan range jika replace diminta)
        const nameBox = document.querySelector("#t-name-box") ||
                        document.querySelector("input#t-name-box") ||
                        document.querySelector("input.name-box-input") ||
                        document.querySelector("[aria-label*='kotak nama' i]") ||
                        document.querySelector("[aria-label*='name box' i]");

        const gridCanvas = document.querySelector("#waffle-grid-tab canvas") || document.querySelector("canvas");
        const activeInput = document.querySelector("#waffle-grid-tab textarea") ||
                            document.querySelector("textarea.clip-target") ||
                            document.querySelector(".waffle-clipboard-target") ||
                            document.activeElement;

        if (nameBox) {
          try {
            nameBox.focus();
            nameBox.value = "A1";
            nameBox.dispatchEvent(new Event("input", { bubbles: true }));
            nameBox.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
            nameBox.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
          } catch (_) {}
          await new Promise(r => setTimeout(r, 60));
        }

        // Fokuskan sel A1 pada canvas Google Sheets
        if (gridCanvas) {
          try {
            gridCanvas.focus?.();
            const rect = gridCanvas.getBoundingClientRect();
            const clickX = Math.round(rect.left + Math.min(80, rect.width / 2));
            const clickY = Math.round(rect.top + Math.min(50, rect.height / 2));
            const evt = { bubbles: true, cancelable: true, clientX: clickX, clientY: clickY };
            gridCanvas.dispatchEvent(new MouseEvent("mousedown", evt));
            gridCanvas.dispatchEvent(new MouseEvent("mouseup", evt));
            gridCanvas.dispatchEvent(new MouseEvent("click", evt));
          } catch (_) {}
        }

        // Jika mode replace, hapus isi grid lama terlebih dahulu
        if (actionData.replace) {
          const targetForKeys = activeInput || gridCanvas || document.body;
          try {
            targetForKeys.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", keyCode: 65, which: 65, ctrlKey: !isMac, metaKey: isMac, bubbles: true }));
            targetForKeys.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", code: "Delete", keyCode: 46, which: 46, bubbles: true }));
            await new Promise(r => setTimeout(r, 60));
            // Kembalikan ke A1
            targetForKeys.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", code: "Home", keyCode: 36, which: 36, ctrlKey: true, bubbles: true }));
          } catch (_) {}
          await new Promise(r => setTimeout(r, 60));
        }

        // A. Waffle Clipboard Engine Injection
        const primaryTarget = document.querySelector("#waffle-grid-tab textarea") ||
                              document.querySelector("textarea.clip-target") ||
                              document.querySelector(".waffle-clipboard-target") ||
                              document.activeElement ||
                              document.body;

        if (primaryTarget) {
          try {
            primaryTarget.focus?.();
            const dt = new DataTransfer();
            dt.setData("text/plain", tsvText);
            dt.setData("text/html", htmlTable);

            primaryTarget.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt }));
            primaryTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "v", code: "KeyV", keyCode: 86, ctrlKey: !isMac, metaKey: isMac, bubbles: true }));
          } catch (_) {}
        }

        // B. Spreadsheet Grid Direct Typing (Tab antar kolom & Enter ganti baris)
        const formulaInput = document.querySelector("#t-formula-bar-input") ||
                             document.querySelector(".cell-input") ||
                             document.querySelector("[id*='formula-bar']") ||
                             document.querySelector(".docs-formula-input") ||
                             document.querySelector("div[role='combobox']#t-formula-bar-input");

        let directCellSuccess = 0;
        if (formulaInput) {
          showReadingHUD(`📊 Mengisikan ${rows.length} baris data ke Google Sheets...`);
          for (let rIdx = 0; rIdx < rows.length; rIdx++) {
            const rowData = rows[rIdx];
            for (let cIdx = 0; cIdx < rowData.length; cIdx++) {
              const cellVal = String(rowData[cIdx] ?? "").trim();
              const isLastColInRow = cIdx === rowData.length - 1;

              // Tulis nilai ke formula bar
              try {
                formulaInput.focus();
                const range = document.createRange();
                range.selectNodeContents(formulaInput);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);

                document.execCommand("insertText", false, cellVal);
                formulaInput.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: cellVal }));
                formulaInput.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: cellVal }));
              } catch (_) {}

              // Navigasi: Tab untuk kolom kanan, Enter di akhir baris untuk pindah ke baris baru
              try {
                if (isLastColInRow) {
                  formulaInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
                  formulaInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
                } else {
                  formulaInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", code: "Tab", keyCode: 9, which: 9, bubbles: true }));
                  formulaInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Tab", code: "Tab", keyCode: 9, which: 9, bubbles: true }));
                }
              } catch (_) {}

              directCellSuccess++;
              await new Promise(r => setTimeout(r, 18));
            }
          }
        }

        showReadingHUD(`✓ Data tabel (${rows.length} baris x ${rows[0]?.length || 0} kolom) berhasil dimasukkan ke Google Sheets!`, true);
        await new Promise(r => setTimeout(r, 400));
        return {
          success: true,
          message: `Berhasil mengisikan ${rows.length} baris x ${rows[0]?.length || 0} kolom (${directCellSuccess} sel) ke Google Sheets.`,
          stateChanged: true
        };
      }

      // 2. Generic HTML Table & Data-Grid Inputs
      let targetGrid = targetElement ? (targetElement.closest("table, [role='grid']") || targetElement) : document.querySelector("table, [role='grid']");
      if (targetGrid) {
        const tableRows = targetGrid.querySelectorAll("tr, [role='row']");
        let filledCells = 0;

        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          const rowData = rows[rIdx];
          const targetRow = tableRows[rIdx];
          if (!targetRow) break;

          const cells = targetRow.querySelectorAll("td, th, [role='gridcell'], input, textarea");
          for (let cIdx = 0; cIdx < rowData.length; cIdx++) {
            const cell = cells[cIdx];
            if (!cell) break;
            const val = rowData[cIdx];
            cell.focus?.();
            if (cell instanceof HTMLInputElement || cell instanceof HTMLTextAreaElement) {
              setNativeInputValue(cell, val);
            } else if (cell.isContentEditable) {
              cell.textContent = val;
              cell.dispatchEvent(new Event("input", { bubbles: true }));
            }
            filledCells++;
          }
        }

        if (filledCells > 0) {
          showReadingHUD(`✓ Mengisi ${filledCells} sel tabel berhasil`, true);
          return { success: true, message: `Berhasil mengisi ${filledCells} sel data pada tabel web.`, stateChanged: true };
        }
      }

      // 3. Fallback: Copy to Clipboard
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(tsvText);
        }
      } catch (_) {}

      showReadingHUD(`✓ Data tabel disiapkan di clipboard (${rows.length} baris)`, true);
      return {
        success: true,
        message: `Data tabel (${rows.length} baris) berhasil disalin dan siap ditempelkan ke spreadsheet.`,
        stateChanged: true
      };
    }

    // ── Modular Skills (skills.sh) DOM Action Handlers ──
    if (action === "extract_table_data") {
      const selector = actionData.selector;
      const targetTable = selector ? document.querySelector(selector) : (document.querySelector("table, [role='grid']") || document.querySelector(".waffle-grid"));
      const columns = [];
      const rows = [];

      if (targetTable) {
        const headerEls = targetTable.querySelectorAll("th, [role='columnheader']");
        headerEls.forEach(th => columns.push(th.textContent.trim()));

        const rowEls = targetTable.querySelectorAll("tbody tr, tr:not(:first-child), [role='row']");
        const maxR = Math.min(rowEls.length, actionData.maxRows || 50);
        for (let i = 0; i < maxR; i++) {
          const cells = rowEls[i].querySelectorAll("td, [role='gridcell']");
          if (cells.length > 0) {
            rows.push(Array.from(cells).map(c => c.textContent.trim()));
          }
        }
      }

      if (rows.length === 0) {
        const cards = document.querySelectorAll("[data-testid*='product' i], .product-card, .goods-item, article");
        if (cards.length > 0) {
          columns.push("Item", "Deskripsi / Info");
          cards.forEach((card, idx) => {
            if (idx < (actionData.maxRows || 30)) {
              rows.push([
                card.querySelector("h2, h3, h4, .title, a")?.textContent?.trim() || `Item ${idx+1}`,
                card.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100)
              ]);
            }
          });
        }
      }

      return {
        success: true,
        columns: columns.length > 0 ? columns : ["Data"],
        rows: rows,
        message: `Berhasil mengekstrak ${rows.length} baris data.`
      };
    }

    if (action === "click_next_page") {
      const nextBtn = document.querySelector("a[rel='next'], button[aria-label*='Next' i], button[aria-label*='Berikutnya' i], a[aria-label*='Next' i], a[aria-label*='Berikutnya' i], .pagination-next, .next-page, [data-testid*='next' i]");
      if (nextBtn) {
        nextBtn.click();
        return { success: true, message: "Tombol halaman berikutnya berhasil diklik." };
      }
      return { success: false, error: "Tombol halaman berikutnya (Next) tidak ditemukan." };
    }

    if (action === "inspect_form_fields") {
      const container = actionData.formSelector ? document.querySelector(actionData.formSelector) : document;
      const inputs = (container || document).querySelectorAll("input:not([type='hidden']), textarea, select");
      const fields = Array.from(inputs).map((el, idx) => {
        let label = "";
        if (el.id) {
          const lblEl = document.querySelector(`label[for="${el.id}"]`);
          if (lblEl) label = lblEl.textContent.trim();
        }
        if (!label) {
          label = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || `Field #${idx+1}`;
        }
        return {
          id: el.id || null,
          name: el.name || null,
          type: el.type || el.tagName.toLowerCase(),
          label,
          placeholder: el.placeholder || null,
          currentValue: el.value || null
        };
      });
      return { success: true, fields, message: `Ditemukan ${fields.length} elemen form.` };
    }

    if (action === "autofill_form_batch") {
      const fields = Array.isArray(actionData.fields) ? actionData.fields : [];
      let filledCount = 0;
      const allElements = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, select"));

      function findMatchingField(ident, elements) {
        if (!ident) return null;
        const normIdent = ident.toLowerCase().trim();
        const isEmailIdent = /email|surel|user|username|akun/i.test(normIdent);
        const isPassIdent = /pass|password|sandi|kata sandi/i.test(normIdent);

        // 1. Semantic type match
        if (isEmailIdent) {
          const emailEl = elements.find(e => e.type === "email" || e.autocomplete === "email" || e.autocomplete === "username");
          if (emailEl) return emailEl;
        }
        if (isPassIdent) {
          const passEl = elements.find(e => e.type === "password" || (e.autocomplete && e.autocomplete.includes("password")));
          if (passEl) return passEl;
        }

        // 2. Exact match on name, id, placeholder, aria-label
        let found = elements.find(elem => {
          const name = (elem.name || "").toLowerCase();
          const id = (elem.id || "").toLowerCase();
          const ph = (elem.placeholder || "").toLowerCase();
          const aria = (elem.getAttribute("aria-label") || "").toLowerCase();
          return name === normIdent || id === normIdent || ph === normIdent || aria === normIdent;
        });
        if (found) return found;

        // 3. Substring match
        found = elements.find(elem => {
          const name = (elem.name || "").toLowerCase();
          const id = (elem.id || "").toLowerCase();
          const ph = (elem.placeholder || "").toLowerCase();
          const aria = (elem.getAttribute("aria-label") || "").toLowerCase();
          return (name && (name.includes(normIdent) || normIdent.includes(name))) ||
                 (id && (id.includes(normIdent) || normIdent.includes(id))) ||
                 (ph && (ph.includes(normIdent) || normIdent.includes(ph))) ||
                 (aria && (aria.includes(normIdent) || normIdent.includes(aria)));
        });
        if (found) return found;

        // 4. Match via label / container text (span, div, p, label)
        found = elements.find(elem => {
          let labelText = "";
          if (elem.id) {
            const lbl = document.querySelector(`label[for="${elem.id}"]`);
            if (lbl) labelText = lbl.textContent.toLowerCase();
          }
          if (!labelText) {
            const parentLbl = elem.closest("label");
            if (parentLbl) labelText = parentLbl.textContent.toLowerCase();
          }
          if (!labelText && elem.parentElement) {
            labelText = (elem.parentElement.innerText || elem.parentElement.textContent || "").toLowerCase();
          }
          if (!labelText && elem.parentElement?.parentElement) {
            labelText = (elem.parentElement.parentElement.innerText || elem.parentElement.parentElement.textContent || "").toLowerCase();
          }
          return labelText && (
            labelText.includes(normIdent) ||
            (isEmailIdent && /email|surel|address|alamat/i.test(labelText)) ||
            (isPassIdent && /pass|password|sandi/i.test(labelText))
          );
        });
        if (found) return found;

        // 5. Intelligent Fallback for Standard Auth / Login Forms
        if (isEmailIdent) {
          const fallbackEmail = elements.find(e => {
            const t = (e.type || "text").toLowerCase();
            return (t === "text" || t === "email" || !t) && !e.disabled && e.offsetParent !== null;
          });
          if (fallbackEmail) return fallbackEmail;
        }
        if (isPassIdent) {
          const fallbackPass = elements.find(e => (e.type || "").toLowerCase() === "password" && !e.disabled);
          if (fallbackPass) return fallbackPass;
        }

        return null;
      }

      fields.forEach(f => {
        const ident = (f.identifier || f.name || f.field || "").toLowerCase().trim();
        const val = f.value ?? "";
        const el = findMatchingField(ident, allElements);

        if (el) {
          setNativeInputValue(el, val);
          filledCount++;
        }
      });

      if (actionData.submitAfter) {
        // Tunggu reactive frameworks (React, Vue, Formik, React Hook Form) menuntaskan validasi input
        await new Promise(r => setTimeout(r, 200));

        let submitBtn = collectElementsDeep("button[type='submit'], input[type='submit'], button.submit-btn, [role='button'][type='submit']")[0];

        if (!submitBtn) {
          const candidates = collectElementsDeep("button, [role='button'], input[type='button'], input[type='submit'], a.btn, a[role='button']");
          submitBtn = candidates.find(b => {
            const txt = (b.innerText || b.textContent || b.value || b.getAttribute("aria-label") || "").trim().toLowerCase();
            return /^(?:sign\s*in|login|masuk|log\s*in|submit|kirim|lanjutkan|next|continue)$/i.test(txt) ||
                   /(?:sign\s*in|login|masuk)/i.test(txt);
          });
        }

        if (submitBtn) {
          triggerFullClickSequence(submitBtn);
          await new Promise(r => setTimeout(r, 300));
        } else {
          const form = document.querySelector("form");
          if (form) {
            try {
              if (typeof form.requestSubmit === "function") form.requestSubmit();
              else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            } catch (_) {}
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }

      return {
        success: true,
        filledCount,
        message: `Berhasil mengisi ${filledCount} field formulir.`
      };
    }

    if (action === "click_canvas_text") {
      const canvas = document.querySelector("canvas");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const clientX = Number.isFinite(actionData.x)
          ? actionData.x
          : Number.isFinite(actionData.relX)
            ? rect.left + rect.width * actionData.relX
            : rect.left + rect.width / 2;
        const clientY = Number.isFinite(actionData.y)
          ? actionData.y
          : Number.isFinite(actionData.relY)
            ? rect.top + rect.height * actionData.relY
            : rect.top + rect.height / 2;

        const eventInit = { bubbles: true, cancelable: true, view: window, clientX, clientY };
        canvas.dispatchEvent(new MouseEvent("mousedown", eventInit));
        canvas.dispatchEvent(new MouseEvent("mouseup", eventInit));
        canvas.dispatchEvent(new MouseEvent("click", eventInit));
        return { success: true, message: `Canvas berhasil diklik pada koordinat (${Math.round(clientX)}, ${Math.round(clientY)}) untuk '${actionData.text || ""}'.` };
      }
      return { success: false, error: "Canvas tidak ditemukan pada halaman ini." };
    }

    // ── paste_text / insert_table / create_table / fill_spreadsheet_grid: insert teks/tabel pada posisi kursor (Google Docs, Google Sheets, Canvas, & Rich Editor friendly) ──
    if (action === "paste_text" || action === "insert_table" || action === "create_table" || action === "fill_table" || action === "fill_spreadsheet_grid" || action === "fill_sheet") {
      const dataPayload = actionData.tableData || actionData.data || actionData.rows || actionData.table || actionData.text || value || "";
      if (!dataPayload) return { success: false, error: "Teks atau data tabel kosong.", errorType: "TOOL_INVALID_ARGUMENT" };

      const isGoogleSheets = window.location.hostname.includes("docs.google.com") && window.location.pathname.includes("/spreadsheets");
      if (isGoogleSheets || action === "fill_spreadsheet_grid" || action === "fill_sheet") {
        return await handleSpreadsheetGridInput(dataPayload);
      }

      const text = typeof dataPayload === "string" ? dataPayload : String(value ?? actionData.text ?? "");

      const isGoogleDocs = window.location.hostname.includes("docs.google.com");
      if (isGoogleDocs) {
        return await handleGoogleDocsTyping(text, actionData);
      }

      const { plain: cleanPlain, html: cleanHtml } = convertMarkdownToRichDoc(text);

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
            // Clear konten lama sebelum menyisipkan (prevents double-write / overwriting)
            try {
              document.execCommand("selectAll", false, null);
              document.execCommand("delete", false, null);
            } catch (_) {
              target.innerText = "";
            }
            target.dispatchEvent(new Event("input", { bubbles: true }));
            try {
              document.execCommand("insertText", false, text);
              inserted = target.innerText.includes(text.slice(0, 20));
            } catch (e) {}
            if (!inserted) {
              target.innerText = text;
              target.dispatchEvent(new Event("input", { bubbles: true }));
              inserted = true;
            }
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
    targetEl.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });

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
        triggerFullClickSequence(targetEl);

        // Khusus tombol Tulis/Compose di Gmail: pastikan form compose terbuka
        const isComposeBtn = /tulis|compose/i.test(targetEl.innerText || targetEl.getAttribute("aria-label") || targetEl.getAttribute("data-tooltip") || "") || targetEl.getAttribute("gh") === "cm" || targetEl.closest('[gh="cm"]');
        if (isComposeBtn && window.location.hostname.includes("mail.google.com")) {
          try {
            safeSendMessage({ action: "NAVIGATE_TAB", url: "https://mail.google.com/mail/u/0/#inbox?compose=new" });
          } catch (_) {}
          try {
            window.location.hash = "#inbox?compose=new";
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "c", code: "KeyC", keyCode: 67, which: 67, bubbles: true }));
          } catch (_) {}
        }

        restoreOutline();
        return { success: true, message: `Klik [@e${cleanId}] berhasil${fuzzyNote}${coveredNote}.`, stateChanged: true };
      }

      if (action === "fill_spreadsheet_grid" || action === "fill_table" || action === "fill_sheet") {
        const dataPayload = actionData.data || actionData.rows || actionData.table || actionData.text || value;
        restoreOutline();
        return await handleSpreadsheetGridInput(dataPayload, targetEl);
      }

      if (action === "type" || action === "type_text" || action === "fill") {
        const textToFill = actionData.text !== undefined ? actionData.text : (value || "");

        // Khusus Google Sheets / Spreadsheet Data Grid
        if (window.location.hostname.includes("docs.google.com") && window.location.pathname.includes("/spreadsheets")) {
          restoreOutline();
          return await handleSpreadsheetGridInput(textToFill, targetEl);
        }

        // Khusus Google Docs: alihkan ke dedicated Google Docs Typing Handler
        if (window.location.hostname.includes("docs.google.com")) {
          restoreOutline();
          return await handleGoogleDocsTyping(textToFill, actionData);
        }

        targetEl.focus();
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

    // Helper polling elemen dengan fallback toleran
    async function waitForElement(selectorFns, timeoutMs = 5000) {
      const fns = Array.isArray(selectorFns) ? selectorFns : [selectorFns];
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        for (const fn of fns) {
          try {
            const el = typeof fn === "string" ? document.querySelector(fn) : fn();
            if (el) return el;
          } catch (_) {}
        }
        await new Promise(r => setTimeout(r, 200));
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
    let composeBox = document.querySelector('div[role="dialog"]') ||
                     document.querySelector('div.nH.Hd[role="dialog"]') ||
                     document.querySelector('table.Ao.Il') ||
                     document.querySelector('div.AD') ||
                     document.querySelector('input[name="subjectbox"]') ||
                     document.querySelector('div.Am.Al.editable');

    if (!composeBox) {
      if (window.location.hostname.includes("mail.google.com")) {
        try {
          if (!window.location.hash.includes("compose=new")) {
            window.location.hash = "#inbox?compose=new";
          }
        } catch (_) {}
      }

      // Cari dan klik tombol Compose
      const composeBtn = document.querySelector('div[gh="cm"]') ||
                         document.querySelector('div.T-I.T-I-KE.L3') ||
                         document.querySelector('div[role="button"][aria-label*="Tulis" i]') ||
                         document.querySelector('div[role="button"][aria-label*="Compose" i]') ||
                         document.querySelector('[data-tooltip*="Compose" i]') ||
                         document.querySelector('[data-tooltip*="Tulis" i]') ||
                         findElementByFuzzy("Tulis", "click") ||
                         findElementByFuzzy("Compose", "click");

      if (composeBtn) {
        const targetBtn = composeBtn.closest('[role="button"]') || composeBtn;
        targetBtn.focus?.();
        const evt = { bubbles: true, cancelable: true, composed: true, view: window };
        targetBtn.dispatchEvent(new PointerEvent("pointerdown", evt));
        targetBtn.dispatchEvent(new MouseEvent("mousedown", evt));
        targetBtn.dispatchEvent(new PointerEvent("pointerup", evt));
        targetBtn.dispatchEvent(new MouseEvent("mouseup", evt));
        targetBtn.dispatchEvent(new MouseEvent("click", evt));
        targetBtn.click?.();
      }

      try {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "c", code: "KeyC", keyCode: 67, which: 67, bubbles: true }));
      } catch (_) {}

      composeBox = await waitForElement([
        'div[role="dialog"]',
        'div.nH.Hd[role="dialog"]',
        'table.Ao.Il',
        'div.AD',
        'input[name="subjectbox"]',
        'div.Am.Al.editable',
        'input.agP'
      ], 6000);
    }

    await new Promise(r => setTimeout(r, 500));

    let filledTo = false;
    let filledSubject = false;
    let filledBody = false;

    // 2. Isi Penerima (To / Kepada) & Verifikasi Chip Terbentuk
    if (to) {
      const toInput = await waitForElement([
        'input[peoplekit-id]',
        'input.agP.vO',
        'input.agP',
        'input.vO',
        'input[aria-label*="Kepada" i]',
        'input[aria-label*="To" i]',
        'input[role="combobox"]',
        'div[aria-label*="Kepada" i] input',
        'div[aria-label*="To" i] input',
        'table.Ao input',
        'textarea[name="to"]',
        'input[name="to"]',
        () => findElementByFuzzy("Kepada", "type"),
        () => findElementByFuzzy("To", "type")
      ], 5000);

      if (toInput) {
        toInput.focus();
        toInput.click?.();
        setNativeInputValue(toInput, to);
        toInput.value = to;
        toInput.dispatchEvent(new Event("input", { bubbles: true }));
        toInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        toInput.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        toInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        toInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", code: "Tab", keyCode: 9, which: 9, bubbles: true }));
        toInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Tab", code: "Tab", keyCode: 9, which: 9, bubbles: true }));
        toInput.dispatchEvent(new Event("change", { bubbles: true }));
        filledTo = true;
        await new Promise(r => setTimeout(r, 400));

        dismissAutocompleteOverlays();
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // 3. Isi Subjek
    if (subject) {
      const subjectInput = await waitForElement([
        'input[name="subjectbox"]',
        'input.aoT',
        'input[aria-label*="Subjek" i]',
        'input[aria-label*="Subject" i]',
        'input[placeholder*="Subjek" i]',
        'input[placeholder*="Subject" i]',
        () => findElementByFuzzy("Subjek", "type"),
        () => findElementByFuzzy("Subject", "type")
      ], 4000);

      if (subjectInput) {
        subjectInput.focus();
        subjectInput.click?.();
        setNativeInputValue(subjectInput, subject);
        subjectInput.value = subject;
        subjectInput.dispatchEvent(new Event("input", { bubbles: true }));
        subjectInput.dispatchEvent(new Event("change", { bubbles: true }));
        filledSubject = true;
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // 4. Isi Pesan (Body)
    if (body) {
      const bodyEditor = await waitForElement([
        'div.Am.Al.editable',
        'div[role="textbox"][aria-label*="Pesan" i]',
        'div[role="textbox"][aria-label*="Message Body" i]',
        'div[role="textbox"][aria-label*="Body" i]',
        'div[role="textbox"]',
        'div.Am.aJh.Al.editable',
        'div[aria-label*="Isi pesan" i]',
        'div[aria-label*="Teks pesan" i]',
        'div.editable[contenteditable="true"]',
        '[contenteditable="true"]'
      ], 4000);

      if (bodyEditor) {
        bodyEditor.focus();
        bodyEditor.click?.();
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(bodyEditor);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (_) {}

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
        if (!inserted || !bodyEditor.innerText?.trim()) {
          bodyEditor.replaceChildren();
          const lines = String(body).split("\n");
          lines.forEach((line, idx) => {
            if (idx > 0) bodyEditor.appendChild(document.createElement("br"));
            if (line) bodyEditor.appendChild(document.createTextNode(line));
          });
        }
        bodyEditor.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: body }));
        bodyEditor.dispatchEvent(new Event("input", { bubbles: true }));
        bodyEditor.dispatchEvent(new Event("change", { bubbles: true }));
        filledBody = true;
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // Tutup autocomplete popovers jika masih ada
    dismissAutocompleteOverlays();
    await new Promise(r => setTimeout(r, 300));

    if (!filledTo && !filledSubject && !filledBody) {
      return {
        success: false,
        error: "Formulir Compose Gmail terbuka namun kolom input (Kepada, Subjek, Isi Pesan) belum berhasil diakses. Silakan coba kembali.",
        stateChanged: true
      };
    }

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
          const target = sendBtn.closest('[role="button"]') || sendBtn;
          target.focus?.();
          const evt = { bubbles: true, cancelable: true, composed: true, view: window };
          target.dispatchEvent(new PointerEvent("pointerdown", evt));
          target.dispatchEvent(new MouseEvent("mousedown", evt));
          target.dispatchEvent(new PointerEvent("pointerup", evt));
          target.dispatchEvent(new MouseEvent("mouseup", evt));
          target.dispatchEvent(new MouseEvent("click", evt));
          target.click?.();
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

    // 1. Cari kotak postingan Twitter / X / Threads / LinkedIn / Facebook
    let composeBox = await waitForElement(() => {
      return document.querySelector('div[data-testid="tweetTextarea_0"]') ||
             document.querySelector('div[role="textbox"][data-testid*="tweetTextarea"]') ||
             document.querySelector('div[data-testid="tweetTextarea_0_label"]') ||
             document.querySelector('div[data-lexical-editor="true"]') ||
             document.querySelector('.ql-editor') ||
             document.querySelector('div[role="textbox"][aria-label*="Post text" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Tweet text" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Teks postingan" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Say something" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Start a thread" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Mulai utas" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Ada kabar apa" i]') ||
             document.querySelector('div[aria-placeholder*="Start a thread" i]') ||
             document.querySelector('div[aria-placeholder*="Mulai utas" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="Apa yang Anda pikirkan" i]') ||
             document.querySelector('div[role="textbox"][aria-label*="What do you want to talk about" i]') ||
             document.querySelector('div[role="textbox"][contenteditable="true"]') ||
             document.querySelector('div[contenteditable="true"]');
    }, 4500);

    if (!composeBox) {
      const startPostBtn = document.querySelector('div[role="button"][aria-label*="New thread" i]') ||
                           document.querySelector('div[role="button"][aria-label*="Utas baru" i]') ||
                           document.querySelector('svg[aria-label*="New thread" i]')?.closest('[role="button"]') ||
                           document.querySelector('svg[aria-label*="Utas baru" i]')?.closest('[role="button"]') ||
                           document.querySelector('div[aria-placeholder*="Start a thread" i]') ||
                           document.querySelector('div[aria-placeholder*="Mulai utas" i]') ||
                           document.querySelector('a[data-testid="SideNav_NewTweet_Button"]') ||
                           document.querySelector('button[aria-label*="Start a post" i]') ||
                           document.querySelector('button[aria-label*="Mulai posting" i]') ||
                           findElementByFuzzy("Start a thread", "click") ||
                           findElementByFuzzy("Mulai utas", "click") ||
                           findElementByFuzzy("Ada kabar apa", "click") ||
                           findElementByFuzzy("Post", "click") ||
                           findElementByFuzzy("Posting", "click");
      if (startPostBtn) {
        startPostBtn.click();
        composeBox = await waitForElement(() => {
          return document.querySelector('div[data-testid="tweetTextarea_0"]') ||
                 document.querySelector('div[role="textbox"][data-testid*="tweetTextarea"]') ||
                 document.querySelector('div[data-lexical-editor="true"]') ||
                 document.querySelector('div[role="textbox"][contenteditable="true"]') ||
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
               document.querySelector('div[role="button"][aria-label*="Post" i]') ||
               document.querySelector('div[role="button"][aria-label*="Posting" i]') ||
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

    if (request.type === "GET_CANVAS_RECTS") {
      const canvases = Array.from(document.querySelectorAll("canvas")).map((c) => {
        const r = c.getBoundingClientRect();
        return {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          ariaLabel: c.getAttribute("aria-label") || "",
          className: c.className || ""
        };
      });
      sendResponse({ success: true, rects: canvases });
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

  // ─────────────────────────────────────────────────────
  // IN-PAGE QUICK ASSISTANCE & SEARCH ENGINE COPILOT
  // ─────────────────────────────────────────────────────
  let pesatSelectionToolbar = null;
  let pesatSelectionPopover = null;
  let pesatFab = null;

  function escapeHtmlText(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function safeSendMessage(message, callback) {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime?.lastError) {
          return;
        }
        if (typeof callback === "function") callback(res);
      });
    } catch (_) {}
  }

  function renderInPageMarkdown(rawText) {
    if (!rawText) return "";
    let s = String(rawText).trim();

    // 1. Escape HTML
    s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Helper for inline styles
    function parseInline(str) {
      return str
        .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
    }

    // 2. Separate headings
    s = s.replace(/([^\n\r])\s*(#{1,6}\s*)/g, "$1\n\n$2");

    // 3. Line by line parsing for block elements
    const lines = s.split("\n");
    let inUl = false;
    let inOl = false;
    let out = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (inOl) { out.push("</ol>"); inOl = false; }
        continue;
      }

      const hMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (hMatch) {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (inOl) { out.push("</ol>"); inOl = false; }
        const level = Math.min(6, hMatch[1].length);
        out.push(`<h${level}>${parseInline(hMatch[2])}</h${level}>`);
        continue;
      }

      const bulletMatch = line.match(/^[\*\-]\s+(.*)/);
      if (bulletMatch) {
        if (!inUl) {
          if (inOl) { out.push("</ol>"); inOl = false; }
          out.push("<ul>");
          inUl = true;
        }
        out.push(`<li>${parseInline(bulletMatch[1])}</li>`);
        continue;
      }

      const numberMatch = line.match(/^(\d+)[\.\)]\s+(.*)/);
      if (numberMatch) {
        if (!inOl) {
          if (inUl) { out.push("</ul>"); inUl = false; }
          out.push("<ol>");
          inOl = true;
        }
        out.push(`<li>${parseInline(numberMatch[2])}</li>`);
        continue;
      }

      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
      out.push(`<p>${parseInline(line)}</p>`);
    }

    if (inUl) out.push("</ul>");
    if (inOl) out.push("</ol>");

    return out.join("");
  }

  function initInPageAssistance() {
    try {
      const root = getOrCreatePesatShadowRoot();
      const existingFabs = Array.from(root.querySelectorAll("#pesat-fab-toggle"));
      if (existingFabs.length > 0) {
        pesatFab = existingFabs[0];
        for (let i = 1; i < existingFabs.length; i++) {
          try { existingFabs[i].remove(); } catch (_) {}
        }
        return;
      }

      if (!root.querySelector("#pesat-fab-toggle")) {
        pesatFab = document.createElement("button");
        pesatFab.id = "pesat-fab-toggle";
        pesatFab.title = "Pesat AI Agent (Tahan & Geser untuk pindah posisi, Klik untuk Sidepanel)";
        pesatFab.innerHTML = `<span style="font-size:22px;line-height:1;pointer-events:none;">⚡</span>`;

        // Pulihkan posisi tersimpan dari localStorage
        try {
          const raw = localStorage.getItem("pesat_fab_pos");
          if (raw) {
            const pos = JSON.parse(raw);
            if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
              const clampedX = Math.min(window.innerWidth - 56, Math.max(10, pos.x));
              const clampedY = Math.min(window.innerHeight - 56, Math.max(10, pos.y));
              pesatFab.style.left = `${clampedX}px`;
              pesatFab.style.top = `${clampedY}px`;
              pesatFab.style.right = "auto";
              pesatFab.style.bottom = "auto";
            }
          }
        } catch (_) {}

        // Drag and Drop State
        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;
        let hasMoved = false;

        const handleDragStart = (clientX, clientY) => {
          isDragging = true;
          hasMoved = false;
          startX = clientX;
          startY = clientY;
          const rect = pesatFab.getBoundingClientRect();
          initialLeft = rect.left;
          initialTop = rect.top;
          pesatFab.style.cursor = "grabbing";
          pesatFab.style.transition = "none";
        };

        const handleDragMove = (clientX, clientY) => {
          if (!isDragging) return;
          const dx = clientX - startX;
          const dy = clientY - startY;
          if (Math.hypot(dx, dy) > 4) {
            hasMoved = true;
          }
          const newLeft = Math.min(window.innerWidth - 54, Math.max(8, initialLeft + dx));
          const newTop = Math.min(window.innerHeight - 54, Math.max(8, initialTop + dy));
          pesatFab.style.left = `${newLeft}px`;
          pesatFab.style.top = `${newTop}px`;
          pesatFab.style.right = "auto";
          pesatFab.style.bottom = "auto";
        };

        const handleDragEnd = () => {
          if (!isDragging) return;
          isDragging = false;
          pesatFab.style.cursor = "grab";
          pesatFab.style.transition = "transform 0.15s, box-shadow 0.15s";

          if (hasMoved) {
            const rect = pesatFab.getBoundingClientRect();
            try {
              localStorage.setItem("pesat_fab_pos", JSON.stringify({ x: rect.left, y: rect.top }));
            } catch (_) {}
          }
        };

        // Mouse Dragging
        pesatFab.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          handleDragStart(e.clientX, e.clientY);
          e.preventDefault();

          const onMouseMove = (me) => handleDragMove(me.clientX, me.clientY);
          const onMouseUp = () => {
            handleDragEnd();
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
          };

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        });

        // Touch Dragging (untuk perangkat sentuh / touch emulator)
        pesatFab.addEventListener("touchstart", (e) => {
          if (e.touches.length === 1) {
            handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
          }
        }, { passive: true });

        pesatFab.addEventListener("touchmove", (e) => {
          if (e.touches.length === 1) {
            handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }, { passive: true });

        pesatFab.addEventListener("touchend", () => {
          handleDragEnd();
        });

        // Click Action (hanya dieksekusi jika tidak sedang digeser)
        pesatFab.addEventListener("click", (e) => {
          e.stopPropagation();
          if (hasMoved) return;

          safeSendMessage({ action: "TOGGLE_SIDEPANEL" }, (res) => {
            if (res?.success === false) {
              showReadingHUD("⚡ Sidepanel: Klik ikon Pesat AI di toolbar browser untuk membuka.");
            }
          });
        });

        root.appendChild(pesatFab);
      }

      document.addEventListener("mouseup", handleTextSelection);
      document.addEventListener("mousedown", (e) => {
        if (pesatHostElement && pesatHostElement.contains(e.target)) return;
        if (pesatSelectionToolbar) pesatSelectionToolbar.style.display = "none";
      });
    } catch (_) {}
  }

  function handleTextSelection() {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";
      if (!text || text.length < 3) {
        if (pesatSelectionToolbar && !pesatSelectionPopover?.matches(":hover")) {
          pesatSelectionToolbar.style.display = "none";
        }
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;

      const root = getOrCreatePesatShadowRoot();
      if (!pesatSelectionToolbar) {
        pesatSelectionToolbar = document.createElement("div");
        pesatSelectionToolbar.id = "pesat-selection-toolbar";
        pesatSelectionToolbar.innerHTML = `
          <button class="pesat-tb-btn" data-action="summarize" title="Rangkum teks">📖 Rangkum</button>
          <button class="pesat-tb-btn" data-action="translate" title="Terjemahkan teks">🌐 Terjemahkan</button>
          <button class="pesat-tb-btn" data-action="explain" title="Jelaskan konsep">💡 Jelaskan</button>
          <button class="pesat-tb-btn" data-action="polish" title="Perbaiki tata bahasa">✏️ Perbaiki</button>
          <button class="pesat-tb-btn pesat-tb-ask" data-action="ask" title="Tanyakan di Sidepanel">⚡ Tanya AI</button>
        `;

        pesatSelectionToolbar.addEventListener("click", (ev) => {
          const btn = ev.target.closest(".pesat-tb-btn");
          if (!btn) return;
          const action = btn.getAttribute("data-action");
          const currentText = window.getSelection()?.toString().trim() || text;

          if (action === "ask") {
            safeSendMessage({ action: "TOGGLE_SIDEPANEL" });
            try {
              chrome.storage.session?.set({ pesat_pending_prompt: { prompt: `Tolong jelaskan mengenai teks berikut:\n\n"${currentText}"`, timestamp: Date.now() } });
            } catch (_) {}
            pesatSelectionToolbar.style.display = "none";
            return;
          }

          showSelectionPopover(currentText, action, rect);
        });

        root.appendChild(pesatSelectionToolbar);
      }

      const topPos = Math.max(10, rect.top + window.scrollY - 44);
      const leftPos = Math.min(window.innerWidth - 380, Math.max(10, rect.left + window.scrollX));
      pesatSelectionToolbar.style.top = `${topPos}px`;
      pesatSelectionToolbar.style.left = `${leftPos}px`;
      pesatSelectionToolbar.style.display = "flex";
    }, 40);
  }

  function showSelectionPopover(selectedText, taskType, anchorRect) {
    const root = getOrCreatePesatShadowRoot();
    if (!pesatSelectionPopover) {
      pesatSelectionPopover = document.createElement("div");
      pesatSelectionPopover.id = "pesat-selection-popover";
      root.appendChild(pesatSelectionPopover);
    }

    const actionLabels = {
      summarize: "📖 Ringkasan Pesat AI",
      translate: "🌐 Terjemahan",
      explain: "💡 Penjelasan Konsep",
      polish: "✏️ Teks Hasil Koreksi"
    };

    pesatSelectionPopover.innerHTML = `
      <div class="pesat-popover-header">
        <span class="pesat-popover-title">${actionLabels[taskType] || "⚡ Pesat AI"}</span>
        <div class="pesat-popover-actions">
          <button class="pesat-popover-copy" title="Salin Jawaban">📋 Salin</button>
          <button class="pesat-popover-close" title="Tutup">✕</button>
        </div>
      </div>
      <div class="pesat-popover-body">
        <div class="pesat-popover-loading">Sedang memproses dengan Pesat AI...</div>
      </div>
    `;

    const popoverTop = anchorRect.bottom + window.scrollY + 8;
    const popoverLeft = Math.min(window.innerWidth - 370, Math.max(10, anchorRect.left + window.scrollX));
    pesatSelectionPopover.style.top = `${popoverTop}px`;
    pesatSelectionPopover.style.left = `${popoverLeft}px`;
    pesatSelectionPopover.style.display = "block";

    const bodyEl = pesatSelectionPopover.querySelector(".pesat-popover-body");
    const copyBtn = pesatSelectionPopover.querySelector(".pesat-popover-copy");
    const closeBtn = pesatSelectionPopover.querySelector(".pesat-popover-close");

    closeBtn.onclick = () => { pesatSelectionPopover.style.display = "none"; };

    safeSendMessage({
      action: "IN_PAGE_AI_QUERY",
      taskType,
      selectedText
    }, (res) => {
      if (res && res.success) {
        bodyEl.innerHTML = `<div class="pesat-popover-content">${renderInPageMarkdown(res.reply)}</div>`;
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(res.reply).then(() => {
            copyBtn.textContent = "✓ Tersalin";
            setTimeout(() => { copyBtn.textContent = "📋 Salin"; }, 2000);
          });
        };
      } else {
        bodyEl.innerHTML = `<div class="pesat-popover-error">⚠️ ${res?.error || "Gagal memproses permintaan."}</div>`;
      }
    });
  }

  let lastCopilotQuery = "";
  function checkSearchEngineCopilot() {
    try {
      if (sessionStorage.getItem("pesat_search_copilot_dismissed") === "true") return;
      const host = window.location.hostname;
      const isSearchEngine = host.includes("google.") || host.includes("bing.com") || host.includes("duckduckgo.com");
      if (!isSearchEngine) return;

      const urlParams = new URLSearchParams(window.location.search);
      const query = (urlParams.get("q") || urlParams.get("query") || "").trim();
      if (!query || query.length < 2) return;
      if (query === lastCopilotQuery) return;

      lastCopilotQuery = query;

      const root = getOrCreatePesatShadowRoot();
      const existing = root.querySelector("#pesat-search-copilot");
      if (existing) {
        try { existing.remove(); } catch (_) {}
      }

      injectSearchCopilotCard(query);
    } catch (_) {}
  }

  function initSearchEngineCopilot() {
    checkSearchEngineCopilot();

    window.addEventListener("popstate", () => {
      setTimeout(checkSearchEngineCopilot, 400);
    });

    const titleEl = document.querySelector("title");
    if (titleEl) {
      const titleObserver = new MutationObserver(() => {
        setTimeout(checkSearchEngineCopilot, 400);
      });
      titleObserver.observe(titleEl, { childList: true, subtree: true });
    }
  }

  function injectSearchCopilotCard(query) {
    const root = getOrCreatePesatShadowRoot();
    if (root.querySelector("#pesat-search-copilot")) return;

    const card = document.createElement("div");
    card.id = "pesat-search-copilot";
    card.innerHTML = `
      <div class="pesat-copilot-header">
        <div class="pesat-copilot-title-row">
          <span class="pesat-copilot-badge">⚡ PESAT AI COPILOT</span>
          <div class="pesat-copilot-controls">
            <button class="pesat-copilot-minimize" title="Ciutkan / Buka">_</button>
            <button class="pesat-copilot-close" title="Tutup">✕</button>
          </div>
        </div>
        <div class="pesat-copilot-query">"${escapeHtmlText(query)}"</div>
      </div>
      <div class="pesat-copilot-body">
        <div class="pesat-copilot-status">⏳ Menganalisis pencarian web...</div>
      </div>
      <div class="pesat-copilot-footer">
        <button class="pesat-copilot-btn pesat-copilot-copy">📋 Salin</button>
        <button class="pesat-copilot-btn pesat-copilot-sidepanel">🚀 Buka di Sidepanel</button>
      </div>
    `;

    root.appendChild(card);

    // Pulihkan posisi tersimpan jika pernah digeser oleh pengguna
    try {
      const savedPos = localStorage.getItem("pesat_copilot_pos");
      if (savedPos) {
        const { x, y } = JSON.parse(savedPos);
        if (typeof x === "number" && typeof y === "number") {
          const safeX = Math.min(window.innerWidth - 80, Math.max(8, x));
          const safeY = Math.min(window.innerHeight - 60, Math.max(8, y));
          card.style.setProperty("left", `${safeX}px`, "important");
          card.style.setProperty("top", `${safeY}px`, "important");
          card.style.setProperty("right", "auto", "important");
          card.style.setProperty("bottom", "auto", "important");
        }
      }
    } catch (_) {}

    // Handler Drag & Drop Panel (seperti tombol FAB)
    const headerEl = card.querySelector(".pesat-copilot-header");
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const handleDragStart = (clientX, clientY) => {
      isDragging = true;
      startX = clientX;
      startY = clientY;
      const rect = card.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      if (headerEl) headerEl.style.cursor = "grabbing";
    };

    const handleDragMove = (clientX, clientY) => {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      const newLeft = Math.min(window.innerWidth - 80, Math.max(8, initialLeft + dx));
      const newTop = Math.min(window.innerHeight - 60, Math.max(8, initialTop + dy));
      card.style.setProperty("left", `${newLeft}px`, "important");
      card.style.setProperty("top", `${newTop}px`, "important");
      card.style.setProperty("right", "auto", "important");
      card.style.setProperty("bottom", "auto", "important");
    };

    const handleDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      if (headerEl) headerEl.style.cursor = "grab";
      const rect = card.getBoundingClientRect();
      try {
        localStorage.setItem("pesat_copilot_pos", JSON.stringify({ x: rect.left, y: rect.top }));
      } catch (_) {}
    };

    if (headerEl) {
      headerEl.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        handleDragStart(e.clientX, e.clientY);
        e.preventDefault();

        const onMouseMove = (me) => handleDragMove(me.clientX, me.clientY);
        const onMouseUp = () => {
          handleDragEnd();
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      headerEl.addEventListener("touchstart", (e) => {
        if (e.target.closest("button") || e.touches.length !== 1) return;
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      headerEl.addEventListener("touchmove", (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      headerEl.addEventListener("touchend", handleDragEnd);
    }

    const minimizeBtn = card.querySelector(".pesat-copilot-minimize");
    const closeBtn = card.querySelector(".pesat-copilot-close");
    const bodyEl = card.querySelector(".pesat-copilot-body");
    const copyBtn = card.querySelector(".pesat-copilot-copy");
    const sidepanelBtn = card.querySelector(".pesat-copilot-sidepanel");

    if (minimizeBtn) {
      minimizeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isMin = card.classList.toggle("pesat-copilot-minimized");
        minimizeBtn.textContent = isMin ? "□" : "_";
        minimizeBtn.title = isMin ? "Perluas panel Copilot" : "Ciutkan panel Copilot";
      };
    }

    const handleClose = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      try {
        sessionStorage.setItem("pesat_search_copilot_dismissed", "true");
      } catch (_) {}
      card.style.setProperty("display", "none", "important");
      try { card.remove(); } catch (_) {}
    };

    closeBtn.addEventListener("click", handleClose);
    closeBtn.addEventListener("pointerdown", handleClose);
    closeBtn.onclick = handleClose;

    sidepanelBtn.onclick = () => {
      safeSendMessage({ action: "TOGGLE_SIDEPANEL" });
      try {
        chrome.storage.session?.set({
          pesat_pending_prompt: {
            prompt: `Jelaskan secara mendalam mengenai topik pencarian ini:\n"${query}"`,
            timestamp: Date.now()
          }
        });
      } catch (_) {}
    };

    safeSendMessage({
      action: "IN_PAGE_AI_QUERY",
      taskType: "search_copilot",
      selectedText: query
    }, (res) => {
      if (res && res.success) {
        bodyEl.innerHTML = `<div class="pesat-copilot-content">${renderInPageMarkdown(res.reply)}</div>`;
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(res.reply).then(() => {
            copyBtn.textContent = "✓ Tersalin";
            setTimeout(() => { copyBtn.textContent = "📋 Salin"; }, 2000);
          });
        };
      } else {
        bodyEl.innerHTML = `<div class="pesat-copilot-error">⚠️ Tidak dapat memuat respons Copilot.</div>`;
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initInPageAssistance();
        initSearchEngineCopilot();
      });
    } else {
      initInPageAssistance();
      initSearchEngineCopilot();
    }
  }
})();
