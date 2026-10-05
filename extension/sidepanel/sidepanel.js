// sidepanel.js - Pesat AI Browser Agent v5.0 (Computer-Use Grade)
// Task State Machine: Planner → Navigator → Validator dengan scratchpad persisten,
// confirmation gate, artifacts, vision grounding, tab management, dan Google Skills.
// (PLAN-COMPUTER-USE.md Phase 1, 3, 6, 7)

document.addEventListener("DOMContentLoaded", async () => {
  // ═══════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════
  const chatArea = document.getElementById("chatArea");
  const promptInput = document.getElementById("promptInput");
  const btnSend = document.getElementById("btnSend");
  const agentStatus = document.getElementById("agentStatus");
  const logToggle = document.getElementById("logToggle");
  const logContent = document.getElementById("logContent");
  const logIcon = document.getElementById("logIcon");
  const stopBar = document.getElementById("stopBar");
  const btnStopAgent = document.getElementById("btnStopAgent");

  const agentStatusIndicator = document.getElementById("agentStatusIndicator");
  const statusIndicatorText = document.getElementById("statusIndicatorText");

  const btnNewChat = document.getElementById("btnNewChat");
  const btnHistory = document.getElementById("btnHistory");
  const btnSettings = document.getElementById("btnSettings");

  const historyDrawer = document.getElementById("historyDrawer");
  const btnCloseHistory = document.getElementById("btnCloseHistory");
  const btnDrawerNewChat = document.getElementById("btnDrawerNewChat");
  const sessionList = document.getElementById("sessionList");
  const btnClearHistory = document.getElementById("btnClearHistory");

  const settingsPanel = document.getElementById("settingsPanel");
  const btnCloseSettings = document.getElementById("btnCloseSettings");
  const btnCancelSettings = document.getElementById("btnCancelSettings");
  const btnSaveSettings = document.getElementById("btnSaveSettings");
  const apiUrlInput = document.getElementById("apiUrlInput");
  const apiFormatSelect = document.getElementById("apiFormatSelect");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const modelNameInput = document.getElementById("modelNameInput");
  const settingsSessionOnly = document.getElementById("settingsSessionOnly");
  const btnSettingsTest = document.getElementById("btnSettingsTest");
  const settingsTestResult = document.getElementById("settingsTestResult");
  const btnToggleSettingsKey = document.getElementById("btnToggleSettingsKey");
  const statTodayRequests = document.getElementById("statTodayRequests");
  const statTodayTokens = document.getElementById("statTodayTokens");
  const googleClientIdInput = document.getElementById("googleClientIdInput");
  const btnGoogleConnect = document.getElementById("btnGoogleConnect");
  const googleStatusEl = document.getElementById("googleStatus");
  const googleAlertBox = document.getElementById("googleAlertBox");
  const btnToggleGoogleGuide = document.getElementById("btnToggleGoogleGuide");
  const googleGuideBox = document.getElementById("googleGuideBox");
  const displayRedirectUri = document.getElementById("displayRedirectUri");
  const btnCopyRedirectUri = document.getElementById("btnCopyRedirectUri");

  // Onboarding Wizard Elements (BYOK First-Run)
  const onboardingModal = document.getElementById("onboardingModal");
  const wizardBaseUrl = document.getElementById("wizardBaseUrl");
  const wizardApiFormat = document.getElementById("wizardApiFormat");
  const wizardApiKey = document.getElementById("wizardApiKey");
  const wizardSessionOnly = document.getElementById("wizardSessionOnly");
  const btnWizardTest = document.getElementById("btnWizardTest");
  const wizardTestResult = document.getElementById("wizardTestResult");
  const btnWizardSave = document.getElementById("btnWizardSave");
  const btnToggleWizardKey = document.getElementById("btnToggleWizardKey");
  const wizardModelItemsList = document.getElementById("wizardModelItemsList");
  const settingsModelItemsList = document.getElementById("settingsModelItemsList");
  const btnWizardAddModel = document.getElementById("btnWizardAddModel");
  const btnSettingsAddModel = document.getElementById("btnSettingsAddModel");
  const wizardProviderToggle = document.getElementById("wizardProviderToggle");
  const settingsProviderToggle = document.getElementById("settingsProviderToggle");
  const btnWizardMore = document.getElementById("btnWizardMore");
  const btnWizardClose = document.getElementById("btnWizardClose");

  // Composer Context & File Attachment Elements (§ 5, 6, 11, 79, 80 PRD)
  const composerChipsTray = document.getElementById("composerChipsTray");
  const mentionPicker = document.getElementById("mentionPicker");
  const mentionPickerList = document.getElementById("mentionPickerList");
  const btnAttachFile = document.getElementById("btnAttachFile");
  const btnTriggerMention = document.getElementById("btnTriggerMention");
  const fileInput = document.getElementById("fileInput");
  const dropOverlay = document.getElementById("dropOverlay");

  const quickChipsContainer = document.getElementById("quickChipsContainer");
  const btnSlideChipsLeft = document.getElementById("btnSlideChipsLeft");
  const btnSlideChipsRight = document.getElementById("btnSlideChipsRight");
  const chipSummarize = document.getElementById("chipSummarize");
  const chipExtract = document.getElementById("chipExtract");
  const chipAutoFill = document.getElementById("chipAutoFill");
  const chipAuditSecurity = document.getElementById("chipAuditSecurity");
  const chipSeoAnalysis = document.getElementById("chipSeoAnalysis");
  const chipCopyText = document.getElementById("chipCopyText");
  const chipToggleMarkers = document.getElementById("chipToggleMarkers");
  const btnComposerModel = document.getElementById("btnComposerModel");
  const composerModelName = document.getElementById("composerModelName");

  // Bug Report & Token Tracker Elements
  const btnBugReport = document.getElementById("btnBugReport");
  const bugReportModal = document.getElementById("bugReportModal");
  const btnCloseBugReport = document.getElementById("btnCloseBugReport");
  const btnCancelBugReport = document.getElementById("btnCancelBugReport");
  const btnSubmitBugReport = document.getElementById("btnSubmitBugReport");
  const bugDescriptionInput = document.getElementById("bugDescriptionInput");
  const bugIncludeLogs = document.getElementById("bugIncludeLogs");
  const bugIncludeDom = document.getElementById("bugIncludeDom");
  const bugReportAlert = document.getElementById("bugReportAlert");
  const tokenTrackerBar = document.getElementById("tokenTrackerBar");
  const tokenTrackerText = document.getElementById("tokenTrackerText");

  // ═══════════════════════════════════════════════════
  // KONFIGURASI TERPUSAT & BYOK STATE
  // ═══════════════════════════════════════════════════
  const CFG = globalThis.PESAT_CONFIG || {
    DEFAULT_API_BASE_URL: "https://api.pesatrouter.com/v1",
    DEFAULT_MODEL: "pesat-flash",
    DEFAULT_API_FORMAT: "openai-chat",
    MAX_STEPS: 30,
    MAX_RETRIES_PER_SUBTASK: 3,
    MAX_REPLANS: 2,
    SCRATCHPAD_TAIL: 8
  };

  // ═══════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════
  let currentSessionId = null;
  let sessions = [];
  let isAgentRunning = false;
  let shouldStopAgent = false;
  let markersVisible = false;
  let activeAbortController = null;
  let visionEnabled = true;
  let googleConnected = false;
  let storedSettings = {
    apiBaseUrl: CFG.DEFAULT_API_BASE_URL,
    apiFormat: CFG.DEFAULT_API_FORMAT,
    apiKey: "",
    modelName: CFG.DEFAULT_MODEL,
    sessionOnly: false,
    googleClientId: ""
  };

  // Context & File Ingestion State (§ 6, 10, 11 PRD)
  let attachedContextSources = []; // Array of ContextSource
  let mentionQuery = "";
  let mentionActiveIndex = 0;
  let currentFilteredMentionSources = [];

  // Task State Machine (Phase 1)
  let activeTask = null;
  let taskCardMsgIndex = -1;
  const TASK_STORAGE_KEY = "pesat_active_task";

  // Resolver interaktif (ask_user / confirmation)
  let askUserResolver = null;
  let confirmResolver = null;

  // Model List State matching Screenshot_17.jpg
  let modelsList = [
    { id: "pesat-lite", name: "pesat-lite", context: "1M", enabled: true },
    { id: "pesat-pro", name: "pesat-pro", context: "1M", hasInfo: true, enabled: true },
    { id: "pesat-flash", name: "pesat-flash", context: "1M", enabled: true }
  ];
  let activeModelId = "pesat-flash";

  // Execution Mode State: "full" (auto-run) | "planning" (waits for user approval after planning)
  let currentAgentMode = "full";
  let planApprovalResolver = null;
  const btnAgentMode = document.getElementById("btnAgentMode");
  const agentModeIcon = document.getElementById("agentModeIcon");
  const agentModeText = document.getElementById("agentModeText");

  function updateAgentModeUI() {
    if (!btnAgentMode) return;
    if (currentAgentMode === "planning") {
      btnAgentMode.className = "composer-mode-pill mode-planning";
      if (agentModeIcon) agentModeIcon.textContent = "📋";
      if (agentModeText) agentModeText.textContent = "Plan";
      btnAgentMode.title = "Mode: Planning (Wajib persetujuan user setelah rencana dibuat). Klik untuk beralih ke Full Mode.";
    } else {
      btnAgentMode.className = "composer-mode-pill";
      if (agentModeIcon) agentModeIcon.textContent = "⚡";
      if (agentModeText) agentModeText.textContent = "Full";
      btnAgentMode.title = "Mode: Full (Eksekusi otomatis sampai selesai). Klik untuk beralih ke Planning Mode.";
    }
  }

  if (btnAgentMode) {
    btnAgentMode.addEventListener("click", async () => {
      currentAgentMode = currentAgentMode === "full" ? "planning" : "full";
      updateAgentModeUI();
      await chrome.storage.local.set({ pesat_agent_mode: currentAgentMode });
      appendLog(`⚙️ Mode eksekusi dialihkan ke: ${currentAgentMode === 'planning' ? 'Planning Mode (Wajib Approval Rencana)' : 'Full Mode (Otomatis Selesai)'}`);
    });
  }

  // ═══════════════════════════════════════════════════
  // MARKDOWN & HTML RENDERER (Clean Semantic Parser + Responsive Tables)
  // ═══════════════════════════════════════════════════
  function parseMarkdown(text) {
    if (!text) return "";

    let rawString = text;
    if (typeof text === "object" && text !== null) {
      rawString = text.text || text.message || text.content || text.reply || JSON.stringify(text);
    } else {
      rawString = String(text);
    }

    // 1. Preserve and protect fenced code blocks
    const codeBlocks = [];
    let s = rawString.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`);
      return `__CODE_BLOCK_${idx}__`;
    });

    // 2. Protect inline code
    const inlineCodes = [];
    s = s.replace(/`([^`\n]+)`/g, (_, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
      return `__INLINE_CODE_${idx}__`;
    });

    // 2.5 Sanitize raw text to prevent DOM-based XSS injection
    s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 3. Headers (h6 to h1, with optional leading whitespace)
    s = s.replace(/^\s*######\s+(.*$)/gim, "<h6>$1</h6>");
    s = s.replace(/^\s*#####\s+(.*$)/gim, "<h5>$1</h5>");
    s = s.replace(/^\s*####\s+(.*$)/gim, "<h4>$1</h4>");
    s = s.replace(/^\s*###\s+(.*$)/gim, "<h3>$1</h3>");
    s = s.replace(/^\s*##\s+(.*$)/gim, "<h2>$1</h2>");
    s = s.replace(/^\s*#\s+(.*$)/gim, "<h1>$1</h1>");

    // 4. Unordered & Ordered lists
    s = s.replace(/^\s*[\*\-]\s+(.*$)/gim, "<li>$1</li>");
    s = s.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
    s = s.replace(/<\/ul>\s*<ul>/g, "");

    s = s.replace(/^\s*\d+\.\s+(.*$)/gim, "<oli>$1</oli>");
    s = s.replace(/(<oli>.*<\/oli>)/gim, "<ol>$1</ol>");
    s = s.replace(/<\/ol>\s*<ol>/g, "");
    s = s.replace(/<oli>/g, "<li>").replace(/<\/oli>/g, "</li>");

    // 5. Bold & Italic
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // 6. Markdown Tables
    if (s.includes("|")) {
      const lines = s.split("\n");
      let inTable = false;
      let isFirstRow = true;
      let res = "";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("|") && line.endsWith("|")) {
          if (!inTable) { inTable = true; isFirstRow = true; res += '<div class="table-container"><table>'; }
          if (/^\|[-:\s|]+\|$/.test(line)) { isFirstRow = false; continue; }
          const cells = line.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          const tag = isFirstRow ? "th" : "td";
          res += "<tr>" + cells.map(c => {
            let clean = c.trim();
            clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
            clean = clean.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
            clean = clean.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
            clean = clean.replace(/\*(.*?)\*/g, "<em>$1</em>");
            clean = clean.replace(/___(.*?)___/g, "<strong><em>$1</em></strong>");
            clean = clean.replace(/__(.*?)__/g, "<strong>$1</strong>");
            clean = clean.replace(/_(.*?)_/g, "<em>$1</em>");
            clean = clean.replace(/(?:^\*+|\*+$)/g, "").trim();
            return `<${tag}>${clean}</${tag}>`;
          }).join("") + "</tr>";
          if (isFirstRow) isFirstRow = false;
        } else {
          if (inTable) { inTable = false; res += "</table></div>\n"; }
          res += line + "\n";
        }
      }
      if (inTable) res += "</table></div>\n";
      s = res;
    }

    // 7. Paragraphs / linebreaks (preserving block HTML)
    const blockTags = /<\/?(h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|div|p|pre|blockquote|hr|button|span|img)/i;
    s = s.split("\n").map(line => {
      const trimmed = line.trim();
      if (!trimmed) return "<br>";
      if (blockTags.test(trimmed)) return trimmed;
      return trimmed + "<br>";
    }).join("\n");

    // 8. Restore code blocks & inline code
    inlineCodes.forEach((c, idx) => { s = s.replace(`__INLINE_CODE_${idx}__`, c); });
    codeBlocks.forEach((c, idx) => { s = s.replace(`__CODE_BLOCK_${idx}__`, c); });

    // 9. Strip dangerous scripts & event attributes
    s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
    s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
    s = s.replace(/\son\w+\s*=\s*(["\x27]).*?\1/gi, "");

    // 10. Wrap tables in responsive containers (jika belum dibungkus)
    if (!s.includes('<div class="table-container">')) {
      s = s.replace(/(<table[\s\S]*?<\/table>)/gi, `<div class="table-container">$1</div>`);
    }

    return s;
  }
  window.parseMarkdown = parseMarkdown;

  function parseIncrementalMarkdown(text) {
    if (!text) return "";
    let s = String(text);
    const fenceMatches = s.match(/```/g);
    if (fenceMatches && fenceMatches.length % 2 === 1) {
      s += "\n```";
    }
    const backticks = s.match(/`/g);
    if (backticks && backticks.length % 2 === 1) {
      s += "`";
    }
    const bolds = s.match(/\*\*/g);
    if (bolds && bolds.length % 2 === 1) {
      s += "**";
    }
    return parseMarkdown(s);
  }
  window.parseIncrementalMarkdown = parseIncrementalMarkdown;

  // ═══════════════════════════════════════════════════
  // STATUS INDICATOR
  // ═══════════════════════════════════════════════════
  function showStatusIndicator(text = "Sedang mengerjakan...") {
    if (agentStatusIndicator && statusIndicatorText) {
      statusIndicatorText.textContent = text;
      agentStatusIndicator.classList.remove("hidden");
    }
  }

  function hideStatusIndicator() {
    if (agentStatusIndicator) {
      agentStatusIndicator.classList.add("hidden");
    }
  }

  // ═══════════════════════════════════════════════════
  // SESSION & HISTORY MANAGEMENT
  // ═══════════════════════════════════════════════════
  async function loadSessions() {
    const data = await chrome.storage.local.get(["agent_sessions", "current_session_id"]);
    sessions = data.agent_sessions || [];
    currentSessionId = data.current_session_id || null;

    if (!currentSessionId || !sessions.find(s => s.id === currentSessionId)) {
      createNewSession(true);
    } else {
      renderCurrentSession();
    }
    renderSessionList();
  }

  async function saveSessions() {
    if (sessions.length > 30) {
      sessions = sessions.slice(0, 30);
    }
    await chrome.storage.local.set({
      agent_sessions: sessions,
      current_session_id: currentSessionId
    });
    renderSessionList();
  }

  function createNewSession(silent = false) {
    if (activeAbortController) {
      try { activeAbortController.abort(); } catch (e) {}
      activeAbortController = null;
    }
    setAgentRunning(false);
    hideStatusIndicator();
    shouldStopAgent = true;
    cancelActiveTask("Pengguna memulai obrolan baru.");

    currentSessionId = "sess_" + Date.now();
    const newSession = {
      id: currentSessionId,
      title: "Obrolan Baru",
      timestamp: Date.now(),
      messages: []
    };
    sessions.unshift(newSession);
    saveSessions();
    renderCurrentSession();
    historyDrawer.classList.add("hidden");

    // Reset prompt input UX
    if (promptInput) {
      promptInput.value = "";
      promptInput.style.height = "auto";
    }

    // Reset Token Tracker UI & background loop tracker
    try {
      chrome.runtime.sendMessage({ action: "RESET_LOOP_TRACKER" });
      updateTokenTrackerUI({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
    } catch (_) {}

    if (!silent) appendLog("Konteks obrolan baru dimulai.");
  }

  function getCurrentSession() {
    return sessions.find(s => s.id === currentSessionId) || null;
  }

  function renderCurrentSession() {
    chatArea.innerHTML = "";
    const session = getCurrentSession();
    if (!session || session.messages.length === 0) {
      renderWelcomeMessage();
      return;
    }

    session.messages.forEach((msg, idx) => {
      if (!msg.taskCard && !msg.multiAgent) renderMessageBubble(msg, idx);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function renderWelcomeMessage() {
    chatArea.innerHTML = `
      <div class="message assistant-message" id="welcomeMessage">
        <div class="message-bubble welcome-card">
          <div class="welcome-header">
            <div class="welcome-logo-circle">⚡</div>
            <div class="welcome-header-text">
              <span class="welcome-title">Pesat Agent</span>
              <span class="welcome-subtitle">Computer-Use AI Browser Assistant</span>
            </div>
          </div>
          <p class="welcome-desc">
            Beri tahu saya apa yang ingin Anda kerjakan di web ini. Gunakan <strong>@</strong> untuk merujuk tab peramban atau tombol <strong>📎</strong> untuk melampirkan dataset / dokumen.
          </p>
          <div class="welcome-suggestions">
            <div class="suggestion-item" data-prompt="Tolong buat ringkasan poin-poin penting dari isi konten halaman web ini.">
              <span class="suggestion-icon">📄</span>
              <div class="suggestion-text">
                <span class="suggestion-title">Rangkum Halaman</span>
                <span class="suggestion-sub">Ekstraksi intisari artikel aktif</span>
              </div>
            </div>
            <div class="suggestion-item" data-prompt="Tolong ekstrak data atau tabel penting dari halaman ini dalam format tabel Markdown.">
              <span class="suggestion-icon">📊</span>
              <div class="suggestion-text">
                <span class="suggestion-title">Ekstrak Tabel Data</span>
                <span class="suggestion-sub">Konversi data ke tabel rapi</span>
              </div>
            </div>
            <div class="suggestion-item" data-prompt="Tuliskan skrip Python sederhana untuk memproses data dari web ini.">
              <span class="suggestion-icon">💻</span>
              <div class="suggestion-text">
                <span class="suggestion-title">Buat Skrip / Kode</span>
                <span class="suggestion-sub">Hasilkan artefak kode yang siap diunduh</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    attachSuggestionListeners();
  }

  function attachSuggestionListeners() {
    document.querySelectorAll(".suggestion-item, .suggestion-tag").forEach(tag => {
      tag.addEventListener("click", () => {
        const prompt = tag.getAttribute("data-prompt");
        if (prompt) {
          applyPromptToInput(prompt);
          handleSend();
        }
      });
    });
  }

  function renderSessionList() {
    sessionList.innerHTML = "";
    if (sessions.length === 0) {
      sessionList.innerHTML = '<div class="history-empty">Belum ada riwayat sesi.</div>';
      return;
    }

    sessions.forEach(sess => {
      const item = document.createElement("div");
      item.className = `session-item ${sess.id === currentSessionId ? 'active' : ''}`;

      const timeStr = new Date(sess.timestamp).toLocaleDateString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      });

      item.innerHTML = `
        <div class="session-info">
          <div class="session-title">${escapeHtml(sess.title)}</div>
          <div class="session-time">${timeStr} · ${sess.messages.length} pesan</div>
        </div>
        <button class="session-delete" title="Hapus Sesi">🗑️</button>
      `;

      item.querySelector(".session-info")?.addEventListener("click", () => {
        currentSessionId = sess.id;
        saveSessions();
        renderCurrentSession();
        historyDrawer.classList.add("hidden");
      });

      item.querySelector(".session-delete")?.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSession(sess.id);
      });

      sessionList.appendChild(item);
    });
  }

  async function deleteSession(id) {
    sessions = sessions.filter(s => s.id !== id);
    if (currentSessionId === id) {
      currentSessionId = sessions.length > 0 ? sessions[0].id : null;
      if (!currentSessionId) createNewSession();
    }
    await saveSessions();
    renderCurrentSession();
  }

  // ═══════════════════════════════════════════════════
  // MESSAGE RENDERING (user / askUser / taskCard / confirmation / artifact / multiAgent / normal)
  // ═══════════════════════════════════════════════════
  function generateCsvFromMarkdownTable(md) {
    const raw = String(md || "");
    const lines = raw.split(/\r?\n/);
    const tableRows = [];

    // 1. Ekstrak baris tabel markdown yang diawali/diakhiri pipe (|)
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.includes("|")) continue;

      // Bersihkan pipe di awal dan akhir jika ada
      const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
      if (/^[-:\s|]+$/.test(inner)) continue; // skip garis pembatas header (---|---|---)

      const cells = inner.split("|").map(cell => {
        let clean = cell.trim();
        // Bersihkan markdown link [Text](url) -> Text
        clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
        // Bersihkan markdown bold/italic
        clean = clean.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/_(.*?)_/g, "$1");
        // Bersihkan karakter backtick code
        clean = clean.replace(/`([^`]+)`/g, "$1");
        return clean;
      });

      if (cells.length > 1 && cells.some(c => c.length > 0)) {
        tableRows.push(cells);
      }
    }

    // 2. Fallback: Jika tidak ada format tabel pipe, ekstrak dari list / data berulang
    if (tableRows.length === 0) {
      tableRows.push(["No", "Nama Produk / Keterangan", "Detail / Spesifikasi"]);
      let itemIdx = 1;
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^[\*\-•\d\.]+\s+/.test(trimmed)) {
          const cleanLine = trimmed.replace(/^[\*\-•\d\.]+\s+/, "")
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1");
          const parts = cleanLine.split(/[:–—\-]\s+/);
          if (parts.length >= 2) {
            tableRows.push([String(itemIdx++), parts[0].trim(), parts.slice(1).join(" - ").trim()]);
          } else if (cleanLine.length > 5) {
            tableRows.push([String(itemIdx++), cleanLine, "-"]);
          }
        }
      }
    }

    // 3. Jika tetap kosong, kembalikan tabel default
    if (tableRows.length === 0) {
      tableRows.push(["Keterangan", "Isi Data"]);
      lines.forEach(l => {
        const t = l.trim().replace(/^#+\s*/, "");
        if (t) tableRows.push(["Info", t]);
      });
    }

    // 4. Standarisasi jumlah kolom per baris
    const maxCols = Math.max(...tableRows.map(r => r.length));
    const normalizedRows = tableRows.map(r => {
      while (r.length < maxCols) r.push("");
      return r;
    });

    // 5. Format ke string CSV RFC 4180
    return normalizedRows.map(row => {
      return row.map(cell => {
        let val = String(cell ?? "");
        if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(",");
    }).join("\r\n");
  }

  function generateExcelSpreadsheetHtml(markdownContent, title = "Tabel Riset Produk Pesat AI") {
    const raw = String(markdownContent || "");
    const lines = raw.split(/\r?\n/);
    const tableRows = [];

    // 1. Ekstrak baris tabel markdown
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.includes("|")) continue;
      const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
      if (/^[-:\s|]+$/.test(inner)) continue;

      const cells = inner.split("|").map(cell => {
        let clean = cell.trim();
        clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
        clean = clean.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/_(.*?)_/g, "$1");
        clean = clean.replace(/`([^`]+)`/g, "$1");
        return clean;
      });

      if (cells.length > 1 && cells.some(c => c.length > 0)) {
        tableRows.push(cells);
      }
    }

    let tableHtml = "";
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(1);

      tableHtml += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; font-family:Calibri,Arial,sans-serif; font-size:10.5pt;">';
      tableHtml += '<thead><tr style="background-color:#1e3a8a; color:#ffffff; font-weight:bold; height:32pt;">';
      headers.forEach(h => {
        tableHtml += `<th style="background-color:#1e3a8a; color:#ffffff; font-weight:bold; padding:8pt 10pt; border:1pt solid #64748b; text-align:left;">${escapeHtml(h)}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      rows.forEach((r, rIdx) => {
        const rowBg = rIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
        tableHtml += `<tr style="background-color:${rowBg};">`;
        r.forEach((c, cIdx) => {
          let cellStyle = 'padding:7pt 9pt; border:1pt solid #cbd5e1; font-size:10pt; vertical-align:middle;';
          if (c.includes("Rp") || c.includes("IDR") || c.includes("$")) {
            cellStyle += ' font-weight:bold; color:#047857; text-align:right;';
          } else if (c.includes("★") || c.includes("Rating")) {
            cellStyle += ' font-weight:bold; color:#d97706; text-align:center;';
          } else if (cIdx === 0 && /^\d+$/.test(c.trim())) {
            cellStyle += ' text-align:center; font-weight:bold;';
          }
          tableHtml += `<td style="${cellStyle}">${escapeHtml(c)}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table>';
    } else {
      tableHtml = parseMarkdown(markdownContent);
    }

    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Data Komparasi</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 15pt; }
    h1 { font-family: 'Sora', 'Calibri', sans-serif; font-size: 15pt; color: #1e3a8a; margin-bottom: 10pt; }
  </style>
</head>
<body>
  <h1>📊 ${escapeHtml(title)}</h1>
  ${tableHtml}
</body>
</html>`;
  }

  function generateWordDocHtml(markdownContent, title = "Dokumen Pesat AI") {
    const htmlBody = parseMarkdown(markdownContent);
    return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: 'Plus Jakarta Sans', 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.65; color: #1e293b; margin: 1in; }
    h1 { font-size: 20pt; color: #1e3a8a; margin-top: 18pt; margin-bottom: 8pt; font-family: 'Sora', 'Calibri Light', sans-serif; font-weight: 700; border-bottom: 1.5pt solid #e2e8f0; padding-bottom: 6pt; }
    h2 { font-size: 14pt; color: #1e40af; margin-top: 14pt; margin-bottom: 6pt; font-family: 'Sora', 'Calibri Light', sans-serif; font-weight: 600; }
    h3 { font-size: 12pt; color: #374151; margin-top: 10pt; margin-bottom: 4pt; }
    p { margin-bottom: 8pt; text-align: justify; }
    ul, ol { margin-top: 4pt; margin-bottom: 8pt; padding-left: 24pt; }
    li { margin-bottom: 4pt; }
    blockquote { border-left: 3.5pt solid #3b82f6; background: #f8fafc; padding: 8pt 12pt; margin: 10pt 0; color: #475569; font-style: italic; }
    table { border-collapse: collapse; width: 100%; margin-top: 10pt; margin-bottom: 10pt; }
    th, td { border: 1px solid #cbd5e1; padding: 6pt 8pt; font-size: 10pt; }
    th { background-color: #f1f5f9; font-weight: bold; }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>`;
  }

  function buildMessageNode(msg, index) {
    const isUser = msg.role === "user";
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${isUser ? "user-message" : "assistant-message"}`;
    msgDiv.setAttribute("data-index", index);

    let msgText = msg.content;
    if (typeof msgText === "object" && msgText !== null) {
      msgText = msgText.text || msgText.message || msgText.content || msgText.reply || JSON.stringify(msgText);
    }

    let contentHtml = "";

    if (isUser) {
      contentHtml = `<div class="message-bubble">${escapeHtml(msgText)}</div>`;
    } else if (msg.askUser) {
      const { question, options } = msg.askUser;
      let askHtml = `
        <div class="message-bubble">
          <div class="ask-user-container">
            <div class="ask-user-question">🤔 ${escapeHtml(question || msgText)}</div>
      `;
      if (Array.isArray(options) && options.length > 0 && !msg.answered) {
        askHtml += `<div class="ask-user-options">`;
        options.forEach((opt) => {
          askHtml += `<button class="ask-user-option-btn" data-answer="${escapeHtml(opt)}">⚡ ${escapeHtml(opt)}</button>`;
        });
        askHtml += `</div>`;
      } else if (msg.answered) {
        askHtml += `<div style="font-size:14px;color:#34d399;margin-top:8px;">✔️ Dijawab: ${escapeHtml(msg.answered)}</div>`;
      }
      askHtml += `
          </div>
        </div>
      `;
      contentHtml = askHtml;
    } else if (msg.confirmation) {
      const c = msg.confirmation;
      let confHtml = `
        <div class="confirm-card">
          <div class="confirm-title">🛡️ Konfirmasi Diperlukan — Aksi Berisiko</div>
          <div style="font-size:14px;color:#cbd5e1;margin-bottom:8px;">${escapeHtml(c.description || "Aksi berikut akan dieksekusi:")}</div>
          <div class="confirm-action-desc">${escapeHtml(c.detail || "")}</div>
      `;
      if (!c.resolved) {
        confHtml += `
          <div class="confirm-actions">
            <button class="confirm-btn confirm-btn-allow" data-conf="once">✅ Izinkan Sekali</button>
            <button class="confirm-btn confirm-btn-allow-all" data-conf="all">🔓 Izinkan semua di task ini</button>
            <button class="confirm-btn confirm-btn-cancel" data-conf="cancel">⛔ Batalkan</button>
          </div>
        `;
      } else {
        confHtml += `<div style="font-size:14px;color:${c.approved ? "#34d399" : "#f87171"};">${c.approved ? "✔️ Disetujui pengguna" : "⛔ Ditolak pengguna"}</div>`;
      }
      confHtml += `</div>`;
      contentHtml = confHtml;
    } else if (msg.resumeTask) {
      const rt = msg.resumeTask;
      contentHtml = `
        <div class="resume-banner">
          <span>⏸️ Ada tugas yang belum selesai: <strong>${escapeHtml((rt.goal || "").substring(0, 80))}</strong></span>
          <button class="confirm-btn confirm-btn-allow" data-resume-task="1">▶ Lanjutkan Task</button>
        </div>
      `;
    } else if (msg.taskCard) {
      contentHtml = renderTaskCardHtml(msg.taskCard);
    } else if (msg.artifact) {
      const a = msg.artifact;
      const contentStr = String(a.content || "");
      const wordCount = contentStr.trim() ? contentStr.trim().split(/\s+/).length : 0;
      const isSocial = a.artifactType === "social" || (a.name && (a.name.startsWith("Thread") || a.name.includes("Sosmed") || a.name.includes("Tweet")));
      const isTable = a.artifactType === "table" || a.artifactType === "csv" || (a.name && (a.name.endsWith(".csv") || a.name.startsWith("Riset")));

      if (isSocial) {
        const postTitle = (a.name || "Draf_Thread_X").replace(/\.txt$/, "").replace(/\.md$/, "");
        contentHtml = `
          <div class="doc-card-container social-card-theme">
            <div class="doc-card-header">
              <div class="doc-card-title-group">
                <span class="doc-badge-icon social-badge">📱</span>
                <div class="doc-card-meta">
                  <div class="doc-card-title">${escapeHtml(postTitle)}</div>
                  <div class="doc-card-subtitle">Format Thread Twitter/X & Medsos • ${wordCount} kata</div>
                </div>
              </div>
              <div class="doc-card-actions">
                <button class="doc-action-btn" data-artifact-act="copy" title="Salin seluruh isi thread">📋 Salin Thread</button>
                <button class="doc-action-btn btn-doc-paste" data-artifact-act="paste" title="Tempel langsung ke kotak postingan X / medsos aktif">⤴️ Tempel ke X / Medsos</button>
              </div>
            </div>
            <div class="doc-card-preview-sheet markdown-body">
              ${parseMarkdown(contentStr)}
            </div>
          </div>
        `;
      } else if (isTable) {
        const tableTitle = (a.name || "Tabel_Riset_Produk").replace(/\.csv$/, "").replace(/\.xls$/, "");
        contentHtml = `
          <div class="doc-card-container table-card-theme">
            <div class="doc-card-header">
              <div class="doc-card-title-group">
                <span class="doc-badge-icon table-badge">📊</span>
                <div class="doc-card-meta">
                  <div class="doc-card-title">${escapeHtml(tableTitle)}</div>
                  <div class="doc-card-subtitle">Format Spreadsheet Excel (.XLS) & Tabel Data (.CSV)</div>
                </div>
              </div>
              <div class="doc-card-actions">
                <button class="doc-action-btn" data-artifact-act="copy" title="Salin seluruh data">📋 Salin Data</button>
                <button class="doc-action-btn btn-doc-download" data-artifact-act="download_excel" title="Unduh spreadsheet Excel dengan format tabel visual rapi">⬇️ Unduh Excel (.xls)</button>
                <button class="doc-action-btn" data-artifact-act="download_csv" title="Unduh file tabel dalam format data murni .CSV">⬇️ .CSV</button>
                <button class="doc-action-btn btn-doc-paste" data-artifact-act="paste" title="Tempel ke dokumen atau lembar kerja aktif">⤴️ Tempel ke Sheet</button>
              </div>
            </div>
            <div class="doc-card-preview-sheet markdown-body">
              ${parseMarkdown(contentStr)}
            </div>
          </div>
        `;
      } else {
        const docTitle = (a.name || "Draf_Dokumen").replace(/\.md$/, ".doc");
        contentHtml = `
          <div class="doc-card-container">
            <div class="doc-card-header">
              <div class="doc-card-title-group">
                <span class="doc-badge-icon">📄</span>
                <div class="doc-card-meta">
                  <div class="doc-card-title">${escapeHtml(docTitle)}</div>
                  <div class="doc-card-subtitle">Format Dokumen Word / Docs • ${wordCount} kata</div>
                </div>
              </div>
              <div class="doc-card-actions">
                <button class="doc-action-btn" data-artifact-act="copy" title="Salin seluruh isi artikel">📋 Salin Teks</button>
                <button class="doc-action-btn btn-doc-download" data-artifact-act="download_doc" title="Unduh file siap buka di Word atau Google Docs">⬇️ Unduh .doc</button>
                <button class="doc-action-btn btn-doc-paste" data-artifact-act="paste" title="Tempel langsung ke lembar kerja dokumen aktif">⤴️ Tempel ke Docs</button>
              </div>
            </div>
            <div class="doc-card-preview-sheet markdown-body">
              ${parseMarkdown(contentStr)}
            </div>
          </div>
        `;
      }
    } else if (msg.multiAgent) {
      const { planner, navigator, validator, finalAnswer } = msg.multiAgent;
      let pipelineHtml = '<div class="agent-pipeline-container">';

      if (planner && planner.steps && planner.steps.length > 0) {
        pipelineHtml += `
          <div class="agent-card planner">
            <div class="agent-card-header">🧠 Planner Agent</div>
            <div class="agent-card-body">
              <ol>${planner.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
            </div>
          </div>
        `;
      }

      if (navigator) {
        pipelineHtml += `
          <div class="agent-card navigator">
            <div class="agent-card-header">🧭 Navigator Agent</div>
            <div class="agent-card-body">
              <div>${escapeHtml(navigator.description || navigator.action)}</div>
              ${navigator.elementId ? `<span class="target-badge">Target: [${escapeHtml(String(navigator.elementId))}]</span>` : ''}
              ${navigator.status ? `<div style="font-size:14px; color:#c7d2fe; margin-top:4px;">Status: ${escapeHtml(navigator.status)}</div>` : ''}
              ${navigator.screenshot ? `<img class="screenshot-thumb" src="${navigator.screenshot}" alt="Bukti visual langkah" />` : ''}
            </div>
          </div>
        `;
      }

      if (validator) {
        pipelineHtml += `
          <div class="agent-card validator">
            <div class="agent-card-header">🎯 Validator Agent</div>
            <div class="agent-card-body">
              <div>${validator.success ? '✅' : '⚠️'} ${escapeHtml(validator.message || 'Verifikasi Selesai')}</div>
            </div>
          </div>
        `;
      }

      pipelineHtml += '</div>';

      if (finalAnswer) {
        pipelineHtml += `<div class="message-bubble markdown-body" style="margin-top:8px;">${parseMarkdown(finalAnswer)}</div>`;
      }

      contentHtml = pipelineHtml;
    } else {
      contentHtml = `<div class="message-bubble markdown-body">${parseMarkdown(msgText)}</div>`;
    }

    msgDiv.innerHTML = `
      ${contentHtml}
      ${isUser ? `
        <div class="message-actions">
          <button class="action-icon-btn btn-edit-prompt" title="Edit prompt & jalankan ulang">✏️ Edit</button>
        </div>
      ` : ''}
    `;

    if (isUser) {
      const btnEdit = msgDiv.querySelector(".btn-edit-prompt");
      if (btnEdit) {
        btnEdit.addEventListener("click", () => editPromptAt(index));
      }
    } else if (msg.askUser) {
      const optionBtns = msgDiv.querySelectorAll(".ask-user-option-btn");
      optionBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const selectedAnswer = btn.getAttribute("data-answer");
          if (selectedAnswer && !isAgentRunning) {
            promptInput.value = selectedAnswer;
            handleSend();
          } else if (selectedAnswer && askUserResolver) {
            msg.answered = selectedAnswer;
            updateMessageInSession(index, { answered: selectedAnswer });
            askUserResolver(selectedAnswer);
            askUserResolver = null;
          }
        });
      });
    } else if (msg.confirmation) {
      const confBtns = msgDiv.querySelectorAll(".confirm-btn");
      confBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const choice = btn.getAttribute("data-conf");
          const approved = choice === "once" || choice === "all";
          const patch = { resolved: true, approved, choice };
          Object.assign(msg.confirmation, patch);
          updateMessageInSession(index, { confirmation: msg.confirmation });
          if (confirmResolver) {
            confirmResolver({ approved, allowAll: choice === "all" });
            confirmResolver = null;
          }
        });
      });
    } else if (msg.artifact) {
      const actBtns = msgDiv.querySelectorAll(".doc-action-btn, .artifact-btn");
      actBtns.forEach((btn) => {
        btn.addEventListener("click", async () => {
          const act = btn.getAttribute("data-artifact-act");
          const a = msg.artifact;
          const contentStr = a.content || "";
          try {
            if (act === "copy") {
              await navigator.clipboard.writeText(contentStr);
              appendLog(`📋 Data/Dokumen "${a.name}" disalin ke clipboard.`);
              const origText = btn.textContent;
              btn.textContent = "✓ Tersalin!";
              setTimeout(() => { btn.textContent = origText; }, 1800);
            } else if (act === "download_excel") {
              const xlsName = (a.name || "Tabel-Riset-Pesat-AI").replace(/\.md$/, "").replace(/\.doc$/, "").replace(/\.csv$/, "") + ".xls";
              const xlsContent = generateExcelSpreadsheetHtml(contentStr, xlsName.replace(/\.xls$/, ""));
              const blob = new Blob([xlsContent], { type: "application/vnd.ms-excel;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = xlsName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              appendLog(`⬇️ Spreadsheet Excel "${xlsName}" berhasil diunduh dengan format tabel visual.`);
              const origText = btn.textContent;
              btn.textContent = "✓ Terunduh (.xls)!";
              setTimeout(() => { btn.textContent = origText; }, 1800);
            } else if (act === "download_csv") {
              const csvName = (a.name || "Tabel-Riset-Pesat-AI").replace(/\.md$/, "").replace(/\.doc$/, "").replace(/\.xls$/, "") + ".csv";
              const csvContent = generateCsvFromMarkdownTable(contentStr);
              const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = csvName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              appendLog(`⬇️ Tabel data "${csvName}" berhasil diunduh dalam format .csv.`);
              const origText = btn.textContent;
              btn.textContent = "✓ Terunduh (.csv)!";
              setTimeout(() => { btn.textContent = origText; }, 1800);
            } else if (act === "download_doc" || act === "download") {
              const docName = (a.name || "Dokumen-Pesat-AI").replace(/\.md$/, "") + ".doc";
              const docHtml = generateWordDocHtml(contentStr, docName);
              const blob = new Blob([docHtml], { type: "application/msword;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = docName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              appendLog(`⬇️ Dokumen "${docName}" berhasil diunduh dalam format .doc.`);
              const origText = btn.textContent;
              btn.textContent = "✓ Terunduh!";
              setTimeout(() => { btn.textContent = origText; }, 1800);
            } else if (act === "paste") {
              const isSocialArt = a.artifactType === "social" || (a.name && (a.name.startsWith("Thread") || a.name.includes("Sosmed") || a.name.includes("Tweet")));
              setAgentRunning(true);
              try {
                if (isSocialArt) {
                  showStatusIndicator("Membuka Twitter/X & menempelkan thread...");
                  appendLog("📱 Menyiapkan navigasi ke Twitter/X untuk menempelkan postingan...");

                  let currentTab = null;
                  try {
                    const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
                    if (tabs && tabs[0]) currentTab = tabs[0];
                  } catch (e) {}

                  const isAlreadySocial = currentTab && /x\.com|twitter\.com/i.test(currentTab.url || "");
                  if (!isAlreadySocial) {
                    await sendToBackground({ action: "NAVIGATE_TAB", url: "https://x.com/compose/post" });
                    await new Promise(r => setTimeout(r, 4000));
                    await sendToContentScript({ type: "WAIT_FOR_DOM_STABLE", maxWaitMs: 4000, stableWindowMs: 800 }, 6000).catch(() => {});
                  }

                  const r = await sendToContentScript({
                    type: "EXECUTE_ACTION",
                    actionData: { action: "post_social", text: contentStr }
                  }, 15000);

                  appendLog(`⤴️ Thread "${a.name}" berhasil ditempel ke kotak postingan Twitter/X.`);
		                } else if (a.artifactType === "table" || a.name?.endsWith(".csv") || a.name?.includes("Spreadsheet") || a.name?.includes("Tabel")) {
		                  showStatusIndicator("Mengisikan tabel data ke Google Sheets...");
		                  appendLog(`📊 Menyiapkan pengisian data tabel "${a.name}" ke Google Sheets...`);

		                  let currentTab = null;
		                  try {
		                    const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
		                    if (tabs && tabs[0]) currentTab = tabs[0];
		                  } catch (e) {}

		                  const isAlreadySheets = currentTab && (/docs\.google\.com\/spreadsheets/i.test(currentTab.url || "") || /excel\.office\.com/i.test(currentTab.url || ""));
		                  if (!isAlreadySheets) {
		                    appendLog("Membuka Google Sheets baru (sheets.new)...");
		                    await sendToBackground({ action: "NAVIGATE_TAB", url: "https://sheets.new" });
		                    await new Promise(r => setTimeout(r, 4500));
		                    await sendToContentScript({ type: "WAIT_FOR_DOM_STABLE", maxWaitMs: 4000, stableWindowMs: 800 }, 6000).catch(() => {});
		                  }

		                  await sendToContentScript({
		                    type: "EXECUTE_ACTION",
		                    actionData: { action: "fill_spreadsheet_grid", value: contentStr }
		                  }, 25000);
		                  appendLog(`⤴️ Data tabel "${a.name}" berhasil diisikan ke spreadsheet.`);
	                } else {
	                  showStatusIndicator("Menempelkan teks ke editor aktif...");
	                  await sendToContentScript({
	                    type: "EXECUTE_ACTION",
	                    actionData: { action: "paste_text", value: contentStr }
	                  }, 10000);
	                  appendLog(`⤴️ Dokumen "${a.name}" ditempel ke editor web aktif.`);
	                }

                const origText = btn.textContent;
                btn.textContent = "✓ Tertempel!";
                setTimeout(() => { btn.textContent = origText; }, 2000);
              } catch (pasteErr) {
                appendLog(`Gagal menempelkan teks: ${pasteErr.message}`, "WARN");
              } finally {
                setAgentRunning(false);
                hideStatusIndicator();
              }
            }
          } catch (err) {
            appendLog(`Error aksi dokumen: ${err.message}`, "WARN");
            setAgentRunning(false);
            hideStatusIndicator();
          }
        });
      });
    }

    return msgDiv;
  }

  function renderMessageBubble(msg, index) {
    chatArea.appendChild(buildMessageNode(msg, index));
  }

  function renderTaskCardHtml(taskCard) {
    const plan = taskCard.plan || [];
    const statusIcon = { PLANNING: "🗓️", EXECUTING: "⚡", VALIDATING: "🔍", WAITING_USER: "⏸️", PAUSED: "⏸️", DONE: "✅", FAILED: "❌", CANCELLED: "⛔" };
    let html = `
      <div class="task-card">
        <div class="task-card-header">${statusIcon[taskCard.status] || "⚡"} Progress Tugas — ${escapeHtml(taskCard.status || "")}</div>
        <div class="task-card-goal">🎯 ${escapeHtml(taskCard.goal || "")}</div>
    `;
    for (const s of plan) {
      const st = s.status || "pending";
      // Simbol standar (§ 36 PRD): ✓ done, ● in_progress, ○ pending, ✕ failed
      const check = st === "done" ? "✓" : (st === "in_progress" ? "●" : (st === "failed" ? "✕" : "○"));
      html += `<div class="plan-item ${st}"><span class="plan-check">${escapeHtml(String(check))}</span><span>${escapeHtml(s.description)}</span></div>`;
    }
    html += `
      </div>
    `;
    return html;
  }

  function editPromptAt(index) {
    const session = getCurrentSession();
    if (!session || !session.messages[index]) return;

    const originalText = session.messages[index].content;
    applyPromptToInput(originalText);

    session.messages = session.messages.slice(0, index);
    saveSessions();
    renderCurrentSession();
    appendLog(`Prompt ke-${index + 1} dimuat kembali untuk diedit.`);
  }

  function cleanAssistantReply(text) {
    if (typeof text === "object" && text !== null) {
      text = text.text || text.message || text.content || text.reply || JSON.stringify(text);
    }
    if (!text || typeof text !== "string") return text || "";
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.message) return parsed.message;
        if (parsed.answer) return parsed.answer;
        if (parsed.text) return parsed.text;
      } catch (e) {}
    }
    const jsonBlock = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock[1]);
        if (parsed.message) return parsed.message;
        if (parsed.answer) return parsed.answer;
        if (parsed.text) return parsed.text;
      } catch (e) {}
    }
    return text;
  }

  function addMessageToCurrentSession(role, content, extras = {}) {
    const session = getCurrentSession();
    if (!session) return -1;
    if (extras.taskCard || extras.multiAgent) return -1;

    let textContent = content;
    if (typeof content === "object" && content !== null) {
      textContent = content.text || content.message || content.content || content.reply || JSON.stringify(content);
    }

    const cleanContent = role === "assistant" && !extras.skipClean ? cleanAssistantReply(textContent) : textContent;
    const msgObj = { role, content: cleanContent, timestamp: Date.now(), ...extras };
    session.messages.push(msgObj);

    if (session.messages.length === 1 && role === "user") {
      const titleStr = typeof cleanContent === "string" ? cleanContent : "Percakapan Baru";
      session.title = titleStr.substring(0, 32) + (titleStr.length > 32 ? "..." : "");
    }

    session.timestamp = Date.now();
    saveSessions();
    renderMessageBubble(msgObj, session.messages.length - 1);
    chatArea.scrollTop = chatArea.scrollHeight;
    return session.messages.length - 1;
  }

  function appendMessage(role, content, extras = {}) {
    return addMessageToCurrentSession(role, content, extras);
  }

  function updateMessageInSession(index, patch) {
    const session = getCurrentSession();
    if (!session || !session.messages[index]) return;
    Object.assign(session.messages[index], patch);
    saveSessions();

    // Re-render bubble targeted secara in-place
    const oldNode = chatArea.querySelector(`.message[data-index="${index}"]`);
    if (oldNode) {
      oldNode.replaceWith(buildMessageNode(session.messages[index], index));
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  }

  // ═══════════════════════════════════════════════════
  // SETTINGS & BYOK ONBOARDING (Direct pesatrouter.com)
  // ═══════════════════════════════════════════════════
  function renderModelItems(containerEl, isWizard = false) {
    if (!containerEl) return;
    containerEl.innerHTML = "";
    modelsList.forEach((m) => {
      const row = document.createElement("div");
      row.className = `model-item-row ${m.id === activeModelId && m.enabled !== false ? "selected" : ""} ${m.enabled === false ? "disabled" : ""}`;
      row.setAttribute("data-model-id", m.id);

      const infoHtml = m.hasInfo ? '<span class="model-info-icon" title="Recommended for complex reasoning">ℹ</span>' : '';
      row.innerHTML = `
        <div class="model-item-left">
          <span class="model-item-name">${escapeHtml(m.name)}</span>
          <span class="model-context-badge">${escapeHtml(m.context || "1M")}</span>
          ${infoHtml}
        </div>
        <div class="model-item-actions">
          <button type="button" class="btn-model-action btn-edit-model" title="Ubah Nama Model">✏️</button>
          <button type="button" class="btn-model-action btn-del-model" title="Hapus Model">🗑️</button>
          <label class="toggle-switch small" title="Status Model">
            <input type="checkbox" class="model-item-toggle" ${m.enabled !== false ? "checked" : ""} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;

      // Klik row untuk memilih model aktif
      row.addEventListener("click", (e) => {
        if (e.target.closest(".model-item-actions")) return;
        if (m.enabled === false) {
          m.enabled = true;
        }
        activeModelId = m.id;
        saveModelsConfig();
        renderAllModelLists();
      });

      // Edit model
      row.querySelector(".btn-edit-model")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const newName = prompt("Ubah nama model PesatRouter:", m.name);
        if (newName && newName.trim()) {
          m.name = newName.trim();
          m.id = newName.trim();
          saveModelsConfig();
          renderAllModelLists();
        }
      });

      // Hapus model
      row.querySelector(".btn-del-model")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (modelsList.length <= 1) {
          alert("Minimal harus ada 1 model di daftar.");
          return;
        }
        modelsList = modelsList.filter(x => x.id !== m.id);
        if (activeModelId === m.id) {
          const firstEnabled = modelsList.find(x => x.enabled !== false);
          activeModelId = firstEnabled?.id || modelsList[0]?.id || "pesat-flash";
        }
        saveModelsConfig();
        renderAllModelLists();
      });

      // Toggle status model
      row.querySelector(".model-item-toggle")?.addEventListener("change", (e) => {
        e.stopPropagation();
        m.enabled = e.target.checked;
        if (!m.enabled && activeModelId === m.id) {
          const firstEnabled = modelsList.find(x => x.enabled !== false);
          activeModelId = firstEnabled?.id || modelsList[0]?.id || "pesat-flash";
        } else if (m.enabled) {
          activeModelId = m.id;
        }
        saveModelsConfig();
        renderAllModelLists();
      });

      containerEl.appendChild(row);
    });
  }

  function renderAllModelLists() {
    renderModelItems(wizardModelItemsList, true);
    renderModelItems(settingsModelItemsList, false);
  }

  function handleAddModel() {
    const name = prompt("Tambahkan model PesatRouter (contoh: pesat-lite, pesat-pro, pesat-flash, pesat-vision):");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (modelsList.some(m => m.id.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Model "${trimmed}" sudah ada di daftar.`);
      return;
    }
    modelsList.push({
      id: trimmed,
      name: trimmed,
      context: "1M",
      enabled: true
    });
    activeModelId = trimmed;
    saveModelsConfig();
    renderAllModelLists();
  }

  async function saveModelsConfig() {
    storedSettings.modelName = activeModelId;
    if (composerModelName) composerModelName.textContent = activeModelId;
    await chrome.storage.local.set({
      pesat_models: modelsList,
      modelName: activeModelId
    });
  }

  if (btnWizardAddModel) {
    btnWizardAddModel.addEventListener("click", handleAddModel);
  }
  if (btnSettingsAddModel) {
    btnSettingsAddModel.addEventListener("click", handleAddModel);
  }

  async function loadSettings() {
    let sessionKey = null;
    try {
      const sess = await chrome.storage.session.get(["apiKey"]);
      if (sess && sess.apiKey) sessionKey = sess.apiKey;
    } catch (e) {}

    const local = await chrome.storage.local.get([
      "apiBaseUrl",
      "apiFormat",
      "apiKey",
      "modelName",
      "sessionOnly",
      "googleClientId",
      "pesat_models"
    ]);

    if (Array.isArray(local.pesat_models) && local.pesat_models.length > 0) {
      modelsList = local.pesat_models;
    } else if (Array.isArray(CFG.DEFAULT_MODELS)) {
      modelsList = [...CFG.DEFAULT_MODELS];
    }

    const enabledModels = modelsList.filter(m => m.enabled !== false);
    if (local.modelName && modelsList.some(m => m.id === local.modelName && m.enabled !== false)) {
      activeModelId = local.modelName;
    } else {
      activeModelId = enabledModels[0]?.id || modelsList[0]?.id || CFG.DEFAULT_MODEL;
    }

    storedSettings = {
      apiBaseUrl: local.apiBaseUrl || CFG.DEFAULT_API_BASE_URL,
      apiFormat: local.apiFormat || CFG.DEFAULT_API_FORMAT,
      apiKey: sessionKey || local.apiKey || "",
      modelName: activeModelId,
      sessionOnly: !!(sessionKey || local.sessionOnly),
      googleClientId: local.googleClientId || ""
    };

    // Sinkronisasi ke form Settings
    if (apiUrlInput) apiUrlInput.value = storedSettings.apiBaseUrl;
    if (apiFormatSelect) apiFormatSelect.value = storedSettings.apiFormat;
    if (apiKeyInput) apiKeyInput.value = storedSettings.apiKey;
    if (settingsSessionOnly) settingsSessionOnly.checked = storedSettings.sessionOnly;
    if (googleClientIdInput) googleClientIdInput.value = storedSettings.googleClientId;

    // Sinkronisasi ke form Wizard
    if (wizardBaseUrl) wizardBaseUrl.value = storedSettings.apiBaseUrl;
    if (wizardApiFormat) wizardApiFormat.value = storedSettings.apiFormat;
    if (wizardApiKey) wizardApiKey.value = storedSettings.apiKey;
    if (wizardSessionOnly) wizardSessionOnly.checked = storedSettings.sessionOnly;

    // Sinkronisasi ke model indicator pill di composer
    if (composerModelName) composerModelName.textContent = activeModelId;

    try {
      currentAgentMode = "full";
      await chrome.storage.local.set({ pesat_agent_mode: "full" });
      updateAgentModeUI();
    } catch (e) {}

    renderAllModelLists();
  }

  function getApiBaseUrl() {
    return (storedSettings.apiBaseUrl && storedSettings.apiBaseUrl.trim()) || CFG.DEFAULT_API_BASE_URL;
  }

  function getApiKey() {
    return (storedSettings.apiKey && storedSettings.apiKey.trim()) || "";
  }

  function getModelName() {
    const enabledModels = modelsList.filter(m => m.enabled !== false);
    if (activeModelId && modelsList.some(m => m.id === activeModelId && m.enabled !== false)) {
      return activeModelId;
    }
    return enabledModels[0]?.id || (storedSettings.modelName && storedSettings.modelName.trim()) || CFG.DEFAULT_MODEL;
  }

  function isConfigured() {
    return Boolean(getApiKey());
  }

  function checkOnboarding() {
    if (!isConfigured() && onboardingModal) {
      onboardingModal.classList.remove("hidden");
    }
  }

  function togglePasswordEye(inputEl, btnEl) {
    if (!inputEl) return;
    const isPass = inputEl.type === "password";
    inputEl.type = isPass ? "text" : "password";
    if (btnEl) btnEl.textContent = isPass ? "🙈" : "👁️";
  }

  if (btnToggleWizardKey && wizardApiKey) {
    btnToggleWizardKey.addEventListener("click", () => togglePasswordEye(wizardApiKey, btnToggleWizardKey));
  }
  if (btnToggleSettingsKey && apiKeyInput) {
    btnToggleSettingsKey.addEventListener("click", () => togglePasswordEye(apiKeyInput, btnToggleSettingsKey));
  }

  // ── Usage Tracker (Informasional Pengganti Kuota & Realtime Task Token Tracker) ──
  function updateTokenTrackerUI(usage = {}) {
    if (!tokenTrackerText) return;
    const promptToks = Number(usage.prompt_tokens) || 0;
    const compToks = Number(usage.completion_tokens) || 0;
    const totalToks = Number(usage.total_tokens) || (promptToks + compToks);
    const maxToks = Number(storedSettings.maxTokens || 4096);

    tokenTrackerText.innerHTML = `Tokens: <strong>${totalToks.toLocaleString("id-ID")}</strong> (Prompt: ${promptToks.toLocaleString("id-ID")}, Output: ${compToks.toLocaleString("id-ID")}) | Max: ${maxToks.toLocaleString("id-ID")}`;
  }

  async function refreshUsageDisplay() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await chrome.storage.local.get(["usageDate", "usageRequests", "usageTokens"]);
      const reqs = data.usageDate === today ? (data.usageRequests || 0) : 0;
      const toks = data.usageDate === today ? (data.usageTokens || 0) : 0;
      if (statTodayRequests) statTodayRequests.textContent = `${reqs} req`;
      if (statTodayTokens) statTodayTokens.textContent = `${toks.toLocaleString("id-ID")}`;

      // Ambil token usage akumulatif task dari background
      chrome.runtime.sendMessage({ action: "GET_TOKEN_USAGE" }, (res) => {
        if (res && res.taskTokenUsage) {
          updateTokenTrackerUI(res.taskTokenUsage);
        }
      });
    } catch (e) {}
  }

  async function recordUsage(usage) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await chrome.storage.local.get(["usageDate", "usageRequests", "usageTokens"]);
      let reqs = data.usageDate === today ? (data.usageRequests || 0) : 0;
      let toks = data.usageDate === today ? (data.usageTokens || 0) : 0;

      reqs += 1;
      const addToks = usage?.total_tokens || 0;
      toks += addToks;

      await chrome.storage.local.set({
        usageDate: today,
        usageRequests: reqs,
        usageTokens: toks
      });
      refreshUsageDisplay();

      // Rekam juga ke background tracker
      chrome.runtime.sendMessage({ action: "RECORD_TOKEN_USAGE", usage });
    } catch (e) {}
  }

  // ── Bug Report Modal Logic ──
  function openBugReportModal() {
    if (!bugReportModal) return;
    if (bugDescriptionInput) bugDescriptionInput.value = "";
    if (bugReportAlert) {
      bugReportAlert.className = "hidden";
      bugReportAlert.textContent = "";
    }
    bugReportModal.classList.remove("hidden");
    setTimeout(() => bugDescriptionInput?.focus(), 80);
  }

  function closeBugReportModal() {
    if (!bugReportModal) return;
    bugReportModal.classList.add("hidden");
  }

  async function submitBugReport() {
    const desc = (bugDescriptionInput?.value || "").trim();
    if (!desc) {
      if (bugReportAlert) {
        bugReportAlert.className = "";
        bugReportAlert.style.background = "rgba(239, 68, 68, 0.2)";
        bugReportAlert.style.border = "1px solid rgba(239, 68, 68, 0.4)";
        bugReportAlert.style.color = "#fca5a5";
        bugReportAlert.textContent = "Silakan tuliskan deskripsi kendala terlebih dahulu.";
      }
      return;
    }

    if (btnSubmitBugReport) {
      btnSubmitBugReport.disabled = true;
      btnSubmitBugReport.innerHTML = `<span>⏳ Mengirim...</span>`;
    }

    let domSnap = null;
    if (bugIncludeDom?.checked) {
      try {
        const scanRes = await sendToContentScript({ type: "SCAN_DOM", showOverlay: false });
        domSnap = scanRes?.data?.reducedDOM || null;
      } catch (_) {}
    }

    const actionLogs = activeTask?.scratchpad || [];
    const lastErr = activeTask?.scratchpad?.slice(-1)?.[0]?.observation || null;

    chrome.runtime.sendMessage({
      action: "SUBMIT_BUG_REPORT",
      userDescription: desc,
      includeLogs: !!bugIncludeLogs?.checked,
      includeDom: !!bugIncludeDom?.checked,
      domSnapshot: domSnap,
      actionLogs: bugIncludeLogs?.checked ? actionLogs : [],
      lastError: lastErr
    }, (response) => {
      if (btnSubmitBugReport) {
        btnSubmitBugReport.disabled = false;
        btnSubmitBugReport.innerHTML = `<span>🚀 Kirim Laporan</span>`;
      }

      if (response && response.success) {
        if (bugReportAlert) {
          bugReportAlert.className = "";
          bugReportAlert.style.background = "rgba(16, 185, 129, 0.2)";
          bugReportAlert.style.border = "1px solid rgba(16, 185, 129, 0.4)";
          bugReportAlert.style.color = "#86efac";
          bugReportAlert.textContent = "✅ Laporan bug berhasil dikirim! Terima kasih atas masukan Anda.";
        }
        setTimeout(() => {
          closeBugReportModal();
        }, 1400);
      } else {
        if (bugReportAlert) {
          bugReportAlert.className = "";
          bugReportAlert.style.background = "rgba(239, 68, 68, 0.2)";
          bugReportAlert.style.border = "1px solid rgba(239, 68, 68, 0.4)";
          bugReportAlert.style.color = "#fca5a5";
          bugReportAlert.textContent = response?.error || "Gagal mengirim laporan. Coba lagi.";
        }
      }
    });
  }

  if (btnBugReport) btnBugReport.addEventListener("click", openBugReportModal);
  if (btnCloseBugReport) btnCloseBugReport.addEventListener("click", closeBugReportModal);
  if (btnCancelBugReport) btnCancelBugReport.addEventListener("click", closeBugReportModal);
  if (btnSubmitBugReport) btnSubmitBugReport.addEventListener("click", submitBugReport);
  if (bugReportModal) {
    bugReportModal.addEventListener("click", (e) => {
      if (e.target === bugReportModal) closeBugReportModal();
    });
  }

  // ── Test Connection Helper ──
  async function runTestConnectionUI(cfg, resultEl, btnEl) {
    if (!resultEl) return;
    resultEl.classList.remove("hidden", "success", "error");
    resultEl.textContent = "⏳ Menguji koneksi ke pesatrouter.com...";
    if (btnEl) btnEl.disabled = true;

    try {
      const res = await PesatAIEngine.testConnection(cfg);
      if (res.success) {
        resultEl.classList.add("success");
        resultEl.textContent = `✅ ${res.message} (Model: ${res.model})`;
        appendLog(`⚡ Test Connection sukses: model ${res.model}`);
      } else {
        resultEl.classList.add("error");
        resultEl.textContent = `❌ ${res.error}`;
        appendLog(`⚠️ Test Connection gagal: ${res.error}`, "WARN");
      }
    } catch (err) {
      resultEl.classList.add("error");
      resultEl.textContent = `❌ Error: ${err.message}`;
    } finally {
      if (btnEl) btnEl.disabled = false;
    }
  }

  if (btnWizardTest) {
    btnWizardTest.addEventListener("click", () => {
      runTestConnectionUI(
        {
          apiBaseUrl: wizardBaseUrl?.value,
          apiFormat: wizardApiFormat?.value,
          apiKey: wizardApiKey?.value,
          modelName: getModelName()
        },
        wizardTestResult,
        btnWizardTest
      );
    });
  }

  if (btnWizardSave) {
    btnWizardSave.addEventListener("click", async () => {
      const rawKey = (wizardApiKey?.value || "").trim();
      if (!rawKey) {
        alert("API Key wajib diisi untuk menggunakan Pesat Agent. Dapatkan API Key di pesatrouter.com.");
        wizardApiKey?.focus();
        return;
      }

      const sessionOnly = !!wizardSessionOnly?.checked;
      const base = (wizardBaseUrl?.value || "").trim() || CFG.DEFAULT_API_BASE_URL;
      const fmt = wizardApiFormat?.value || CFG.DEFAULT_API_FORMAT;

      storedSettings = {
        apiBaseUrl: base,
        apiFormat: fmt,
        apiKey: rawKey,
        modelName: activeModelId,
        sessionOnly,
        googleClientId: storedSettings.googleClientId || ""
      };

      if (sessionOnly) {
        try { await chrome.storage.session.set({ apiKey: rawKey }); } catch (e) {}
        await chrome.storage.local.set({
          apiBaseUrl: base,
          apiFormat: fmt,
          modelName: activeModelId,
          pesat_models: modelsList,
          sessionOnly: true
        });
        await chrome.storage.local.remove(["apiKey"]);
      } else {
        await chrome.storage.local.set({
          apiBaseUrl: base,
          apiFormat: fmt,
          apiKey: rawKey,
          modelName: activeModelId,
          pesat_models: modelsList,
          sessionOnly: false
        });
        try { await chrome.storage.session.remove(["apiKey"]); } catch (e) {}
      }

      await loadSettings();
      if (onboardingModal) onboardingModal.classList.add("hidden");
      appendLog("🎉 API Key pesatrouter.com berhasil dikonfigurasi.");
      addMessageToCurrentSession(
        "assistant",
        "✅ **Konfigurasi Berhasil!** Ekstensi terhubung langsung ke akun **pesatrouter.com** Anda. Silakan ketik perintah otomatisasi atau pilih tombol cepat di bawah.",
        { skipClean: true }
      );
    });
  }

  if (btnSettingsTest) {
    btnSettingsTest.addEventListener("click", () => {
      runTestConnectionUI(
        {
          apiBaseUrl: apiUrlInput?.value,
          apiFormat: apiFormatSelect?.value,
          apiKey: apiKeyInput?.value,
          modelName: getModelName()
        },
        settingsTestResult,
        btnSettingsTest
      );
    });
  }

  btnSaveSettings.addEventListener("click", async () => {
    const rawKey = (apiKeyInput?.value || "").trim();
    const sessionOnly = !!settingsSessionOnly?.checked;
    const base = (apiUrlInput?.value || "").trim() || CFG.DEFAULT_API_BASE_URL;
    const fmt = apiFormatSelect?.value || CFG.DEFAULT_API_FORMAT;
    const googleId = (googleClientIdInput?.value || "").trim();

    storedSettings = {
      apiBaseUrl: base,
      apiFormat: fmt,
      apiKey: rawKey,
      modelName: activeModelId,
      sessionOnly,
      googleClientId: googleId
    };

    if (sessionOnly) {
      try { await chrome.storage.session.set({ apiKey: rawKey }); } catch (e) {}
      await chrome.storage.local.set({
        apiBaseUrl: base,
        apiFormat: fmt,
        modelName: activeModelId,
        pesat_models: modelsList,
        sessionOnly: true,
        googleClientId: googleId
      });
      await chrome.storage.local.remove(["apiKey"]);
    } else {
      await chrome.storage.local.set({
        apiBaseUrl: base,
        apiFormat: fmt,
        apiKey: rawKey,
        modelName: activeModelId,
        pesat_models: modelsList,
        sessionOnly: false,
        googleClientId: googleId
      });
      try { await chrome.storage.session.remove(["apiKey"]); } catch (e) {}
    }

    await loadSettings();
    settingsPanel.classList.add("hidden");
    appendLog("✅ Pengaturan API pesatrouter disimpan.");
  });

  // ── BYOK Gate Helper (pesan panduan jika mencoba chat tanpa key) ──
  function showByokGateMessage() {
    addMessageToCurrentSession(
      "assistant",
      "⚠️ **API Key pesatrouter.com Belum Dikonfigurasi**\n\nUntuk menjalankan instruksi otomatisasi, Anda wajib memiliki API Key dari [pesatrouter.com](https://pesatrouter.com).\n\nSilakan klik tombol **⚙️ Pengaturan** di pojok kanan atas untuk memasukkan Base URL dan API Key Anda.",
      { skipClean: true }
    );
    if (onboardingModal) onboardingModal.classList.remove("hidden");
  }

  // ── Google Connection (Phase 5) ──
  const googleConnectText = document.getElementById("googleConnectText");

  function showGoogleAlert(type, message) {
    if (!googleAlertBox) return;
    googleAlertBox.className = `google-alert-box ${type}`;
    googleAlertBox.innerHTML = message;
    googleAlertBox.classList.remove("hidden");
  }

  function hideGoogleAlert() {
    if (googleAlertBox) googleAlertBox.classList.add("hidden");
  }

  async function refreshGoogleStatus() {
    hideGoogleAlert();
    try {
      const res = await sendToBackground({ action: "GOOGLE_STATUS" });
      googleConnected = !!(res && res.connected);
      if (googleConnected) {
        if (googleStatusEl) {
          googleStatusEl.textContent = `🟢 Terhubung (${res.email || "Google Workspace"})`;
          googleStatusEl.className = "google-status connected";
        }
        if (googleConnectText) googleConnectText.textContent = "Putuskan Akun Google";
        btnGoogleConnect?.classList.add("connected");
      } else {
        if (googleStatusEl) {
          googleStatusEl.textContent = "⚪ Belum terhubung";
          googleStatusEl.className = "google-status disconnected";
        }
        if (googleConnectText) googleConnectText.textContent = "Masuk dengan Google (API Latar Belakang)";
        btnGoogleConnect?.classList.remove("connected");
      }
    } catch (e) {
      if (googleStatusEl) googleStatusEl.textContent = "⚪ Belum terhubung";
    }
  }

  btnGoogleConnect?.addEventListener("click", async () => {
    btnGoogleConnect.disabled = true;
    hideGoogleAlert();
    try {
      // Auto-save client ID dari input jika diisi oleh pengguna
      let customId = (googleClientIdInput?.value || "").trim();
      if (!customId) {
        const localData = await chrome.storage.local.get(["googleClientId"]);
        customId = localData.googleClientId || "";
      } else {
        await chrome.storage.local.set({ googleClientId: customId });
      }

      if (googleConnected) {
        const res = await sendToBackground({ action: "GOOGLE_DISCONNECT" });
        if (res && res.success) {
          appendLog("Koneksi Google diputuskan.");
          showGoogleAlert("info", "Koneksi Google diputuskan. Otomatisasi tab Google Sheets/Docs tetap berfungsi normal.");
        }
      } else {
        if (!customId) {
          // Buka details section agar user tahu kolom pengisian Client ID
          const detailsEl = document.querySelector(".advanced-google-details");
          if (detailsEl) detailsEl.open = true;
          googleClientIdInput?.focus();
          showGoogleAlert("info", "💡 <strong>Cara Menghubungkan Google Workspace:</strong><br><br>1. <strong>Otomatisasi Tab (Rekomendasi - Tanpa Login):</strong> Anda bisa langsung meminta AI Agent membuka dan mengedit Google Sheets/Docs/Gmail di browser Chrome tanpa setup!<br><br>2. <strong>API Latar Belakang:</strong> Buat OAuth Client ID di Google Cloud Console, masukkan ke kolom <em>Custom OAuth Client ID</em> di bawah, lalu klik tombol ini lagi.");
          btnGoogleConnect.disabled = false;
          return;
        }

        const res = await sendToBackground({
          action: "GOOGLE_CONNECT",
          clientId: customId || undefined
        });
        if (res && res.success) {
          appendLog(`✅ ${res.message || "Google berhasil dihubungkan."}`);
          showGoogleAlert("success", `✅ ${res.message || "Akun Google berhasil dihubungkan!"}`);
        } else {
          appendLog(`⚠️ Google: ${res?.error || "gagal"}`, "WARN");
          const errText = res?.error || "Operasi Google gagal.";
          if (errText.includes("belum terpasang") || errText.includes("belum diisi")) {
            const detailsEl = document.querySelector(".advanced-google-details");
            if (detailsEl) detailsEl.open = true;
            showGoogleAlert("info", "💡 <strong>Otomatisasi Tab Sudah Aktif (Tanpa Login):</strong><br>Anda dapat langsung meminta AI Agent membuka dan mengedit Google Sheets atau Docs Anda di tab browser Chrome tanpa login akun di sini.<br><br><small style='color:#94a3b8;'>Jika Anda ingin menghubungkan API latar belakang, masukkan Client ID pada menu Pengaturan Client ID di bawah.</small>");
          } else {
            showGoogleAlert("error", `❌ ${errText}`);
          }
        }
      }
    } catch (err) {
      appendLog(`Error koneksi Google: ${err.message}`, "ERROR");
      showGoogleAlert("error", `❌ Gagal menghubungi layanan Google: ${err.message}`);
    } finally {
      btnGoogleConnect.disabled = false;
      await refreshGoogleStatus();
    }
  });

  // ── Google Guide Toggle & Redirect URI Helper ──
  const currentRedirectUri = (typeof chrome !== "undefined" && chrome.identity?.getRedirectURL)
    ? chrome.identity.getRedirectURL("goog")
    : "https://<extension-id>.chromiumapp.org/goog";

  if (displayRedirectUri) {
    displayRedirectUri.textContent = currentRedirectUri;
  }

  if (btnCopyRedirectUri) {
    btnCopyRedirectUri.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentRedirectUri);
        btnCopyRedirectUri.textContent = "✓ Disalin!";
        setTimeout(() => { btnCopyRedirectUri.textContent = "📋 Salin"; }, 2000);
      } catch (e) {}
    });
  }

  if (btnToggleGoogleGuide && googleGuideBox) {
    btnToggleGoogleGuide.addEventListener("click", () => {
      const isHidden = googleGuideBox.classList.toggle("hidden");
      btnToggleGoogleGuide.textContent = isHidden ? "📖 Panduan Cara Buat" : "✕ Tutup Panduan";
    });
  }

  function sendToContentScript(payload, timeoutMs = 15000, maxRetries = 2) {
    return new Promise((resolve) => {
      let resolved = false;
      let retryCount = 0;

      const attemptSend = () => {
        const timer = setTimeout(() => {
          if (!resolved) {
            if (retryCount < maxRetries) {
              retryCount++;
              appendLog(`[Retry ${retryCount}/${maxRetries}] Content script timeout, mencoba ulang...`, "WARN");
              attemptSend();
            } else {
              resolved = true;
              resolve({
                success: false,
                error: "Content script tidak merespon setelah beberapa percobaan. Halaman mungkin sedang memuat atau terproteksi."
              });
            }
          }
        }, timeoutMs);

        chrome.runtime.sendMessage(
          { action: "EXECUTE_IN_CONTENT", payload },
          (response) => {
            if (!resolved) {
              clearTimeout(timer);
              if (chrome.runtime.lastError) {
                if (retryCount < maxRetries) {
                  retryCount++;
                  appendLog(`[Retry ${retryCount}/${maxRetries}] Jalur komunikasi belum siap, mengulang...`, "WARN");
                  setTimeout(attemptSend, 800);
                  return;
                }
                resolved = true;
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                resolved = true;
                resolve(response?.data || response || { success: false, error: "No response" });
              }
            }
          }
        );
      };

      attemptSend();
    });
  }

  function sendToBackground(message, timeoutMs = 15000) {
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: "Background timeout" });
        }
      }, timeoutMs);

      chrome.runtime.sendMessage(message, (response) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false, error: "No response" });
          }
        }
      });
    });
  }

  // Navigasi URL tab browser secara andal (langsung via chrome.tabs API atau background)
  async function navigateToUrl(destUrl) {
    if (!destUrl) return { success: false, error: "URL tidak valid" };
    let dest = String(destUrl).trim();
    if (!/^https?:\/\//i.test(dest)) {
      dest = "https://" + dest;
    }

    // 1. Prioritas Utama: Navigasi langsung via chrome.tabs API di Tab Aktif
    try {
      if (typeof chrome !== "undefined" && chrome.tabs?.query && chrome.tabs?.update) {
        const tabs = await new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (t) => resolve(t || []));
        });
        if (tabs && tabs.length > 0 && tabs[0].id) {
          const tabId = tabs[0].id;
          await chrome.tabs.update(tabId, { url: dest });
          appendLog(`🌐 chrome.tabs.update berhasil membuka tab ${tabId}: ${dest}`);
          return { success: true, url: dest, message: `Membuka URL: ${dest}` };
        }
      }
    } catch (tabErr) {
      appendLog(`⚠️ Gagal direct chrome.tabs.update (${tabErr.message}), mencoba fallback background...`, "WARN");
    }

    // 2. Fallback via background script NAVIGATE_TAB
    const bgRes = await sendToBackground({ action: "NAVIGATE_TAB", url: dest });
    if (bgRes && bgRes.success) {
      return bgRes;
    }

    // 3. Fallback terakhir via content script jika memungkinkan
    try {
      const csRes = await sendToContentScript({
        type: "EXECUTE_ACTION",
        actionData: { action: "navigate", value: dest, url: dest }
      }, 5000);
      if (csRes && csRes.success) return csRes;
    } catch (_) {}

    return bgRes || { success: false, error: "Gagal menavigasi ke URL tujuan" };
  }

  // ═══════════════════════════════════════════════════
  // TASK STATE MACHINE (Phase 1)
  // ═══════════════════════════════════════════════════
  function newTask(goal, contextSources = []) {
    return {
      id: "task_" + Date.now(),
      goal,
      status: "PLANNING",
      plan: [],
      currentSubtask: null,
      scratchpad: [],
      stepsUsed: 0,
      stepBudget: CFG.MAX_STEPS,
      replansUsed: 0,
      retries: {},
      clarifications: [],
      artifacts: [],
      contextSources: contextSources || [],
      confirmAllGranted: false,
      stuckCounter: 0,
      lastPageHash: "",
      createdAt: Date.now()
    };
  }

  async function persistTask() {
    if (!activeTask) return;
    try {
      // Jangan persist screenshot base64 (besar) — hanya runtime in-memory
      const { _pendingScreenshot, ...persistable } = activeTask;
      await chrome.storage.session.set({ [TASK_STORAGE_KEY]: persistable });
    } catch (e) { /* storage.session tidak tersedia — abaikan */ }
  }

  async function clearPersistedTask() {
    try {
      await chrome.storage.session.remove(TASK_STORAGE_KEY);
    } catch (e) {}
  }

  async function loadResumableTask() {
    try {
      const data = await chrome.storage.session.get([TASK_STORAGE_KEY]);
      const task = data?.[TASK_STORAGE_KEY];
      if (task && ["PLANNING", "EXECUTING", "WAITING_USER", "PAUSED"].includes(task.status)) {
        appendResumeBanner(task);
      }
    } catch (e) {}
  }

  function appendResumeBanner(task) {
    const session = getCurrentSession();
    if (!session) return;
    const msgObj = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      resumeTask: { goal: task.goal, stepsUsed: task.stepsUsed, status: task.status }
    };
    session.messages.push(msgObj);
    saveSessions();
    renderMessageBubble(msgObj, session.messages.length - 1);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function taskSummaryForLLM() {
    if (!activeTask) return null;
    return {
      goal: activeTask.goal,
      plan: activeTask.plan,
      currentSubtask: activeTask.currentSubtask,
      scratchpad: activeTask.scratchpad.slice(-CFG.SCRATCHPAD_TAIL),
      clarifications: activeTask.clarifications,
      contextSources: activeTask.contextSources || []
    };
  }

  function currentSubtaskObj() {
    if (!activeTask) return null;
    return activeTask.plan.find(s => s.status !== "done" && s.status !== "skipped") || null;
  }

  function markSubtask(id, status) {
    if (!activeTask) return;
    const s = activeTask.plan.find(x => x.id === id);
    if (s) s.status = status;
  }

  function refreshTaskCard() {
    if (!activeTask || taskCardMsgIndex < 0) return;
    updateMessageInSession(taskCardMsgIndex, {
      taskCard: {
        goal: activeTask.goal,
        status: activeTask.status,
        plan: activeTask.plan,
        currentSubtask: activeTask.currentSubtask,
        stepsUsed: activeTask.stepsUsed,
        stepBudget: activeTask.stepBudget,
        replansUsed: activeTask.replansUsed
      }
    });
  }

  function cancelActiveTask(reason) {
    if (activeTask) {
      activeTask.status = "CANCELLED";
      refreshTaskCard();
      appendLog(`⛔ Task dibatalkan: ${reason}`, "WARN");
      activeTask = null;
      taskCardMsgIndex = -1;
      clearPersistedTask();
    }
    if (askUserResolver) { askUserResolver(null); askUserResolver = null; }
    if (confirmResolver) { confirmResolver({ approved: false, cancelled: true }); confirmResolver = null; }
  }

  // ═══════════════════════════════════════════════════
  // LLM BRIDGE (Direct pesatrouter.com BYOK via ai-engine.js)
  // ═══════════════════════════════════════════════════
  async function callLLM(phase, promptText, { image = null, isSummarize = false, onChunk = null } = {}) {
    if (!isConfigured()) {
      showByokGateMessage();
      throw new Error("API Key pesatrouter belum diatur.");
    }

    const session = getCurrentSession();
    const history = (session?.messages || []).slice(-6).map(m => ({
      role: m.role,
      content: String(m.content || "").substring(0, 2000)
    }));

    activeAbortController = new AbortController();

    try {
      const res = await PesatAIEngine.callLLMDirect({
        phase,
        prompt: promptText,
        messages: history,
        taskState: taskSummaryForLLM(),
        image: image && visionEnabled && phase === "act" ? image : null,
        capabilities: { google: googleConnected, vision: visionEnabled },
        config: {
          apiBaseUrl: getApiBaseUrl(),
          apiKey: getApiKey(),
          modelName: getModelName()
        },
        signal: activeAbortController.signal,
        isSummarize: isSummarize,
        onChunk: onChunk
      });

      if (res.visionFallback) {
        visionEnabled = false;
        appendLog("👁️ Payload image ditolak engine — mode vision dimatikan untuk sesi ini.", "WARN");
      }

      if (res.usage) {
        recordUsage(res.usage);
      }

      const replyStr = res.reply || "";
      const resultWrapper = new String(replyStr);
      resultWrapper.tool_calls = res.tool_calls || null;
      resultWrapper.message = res.message || null;
      resultWrapper.reply = replyStr;
      return resultWrapper;
    } catch (err) {
      if (err.name === "AbortError") throw err;
      appendLog(`AI Error (${phase}): ${err.message}`, "ERROR");
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════
  // ACTION PARSING
  // ═══════════════════════════════════════════════════
  function parseActionJSON(rawReply) {
    if (!rawReply) return null;
    const jsonMatch =
      rawReply.match(/```json\s*([\s\S]*?)\s*```/) ||
      rawReply.match(/\{[\s\S]*"action"[\s\S]*\}/) ||
      rawReply.match(/\{[\s\S]*"actions"[\s\S]*\}/) ||
      rawReply.match(/\{[\s\S]*"planner"[\s\S]*\}/) ||
      rawReply.match(/\{[\s\S]*"plan"[\s\S]*\}/) ||
      rawReply.match(/\{[\s\S]*"verdict"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (e) {
        console.error("[Pesat] JSON parse error:", e);
      }
    }

    // Coba parse seluruh teks sebagai JSON
    const trimmed = rawReply.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {}
    }

    return null;
  }

  // Helper ekstraksi parameter email (To, Subject, Body) yang presisi
  function extractEmailParameters(text = "") {
    if (!text) return { to: "", subject: "Pesan Baru", body: "" };

    let to = "";
    let subject = "";
    let body = "";

    // 1. Ekstrak Email Penerima
    const toMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (toMatch) {
      to = toMatch[1].trim();
    }

    // 2. Ekstrak Subjek (Mendukung tanda kutip atau unquoted dengan toleransi kata sambung/nya)
    const quotedSubMatch = text.match(/(?:subjek|subject|judul)(?:\s+isi)?(?:\s+pesan)?(?:\s+email)?(?:\s+nya)?\s*[:=]?\s*["'“`]([^"'”`\n]+)["'”`]/i);
    if (quotedSubMatch) {
      subject = quotedSubMatch[1].trim();
    } else {
      const unquotedSubMatch = text.match(/(?:subjek|subject|judul)(?:\s+isi)?(?:\s+pesan)?(?:\s+email)?(?:\s+nya)?\s*[:=]?\s*([^,\n.]+?)(?=\s+(?:lalu|dan|kemudian|isi|pesan|body|dengan isi)|[.,\n]|$)/i);
      if (unquotedSubMatch) {
        subject = unquotedSubMatch[1].trim();
      }
    }

    // 3. Ekstrak Isi Pesan / Body (Mendukung tanda kutip atau unquoted)
    const quotedBodyMatch = text.match(/(?:isi\s+pesan(?:\s+email)?|pesan(?:\s+email)?|isi(?:\s+email)?|body)(?:\s+nya)?\s*[:=]?\s*["'“`]([^"'”`\n]+)["'”`]/i);
    if (quotedBodyMatch) {
      body = quotedBodyMatch[1].trim();
    } else {
      const unquotedBodyMatch = text.match(/(?:isi\s+pesan(?:\s+email)?|pesan(?:\s+email)?|isi(?:\s+email)?|body)(?:\s+nya)?\s*[:=]?\s*([^\n]+)$/i);
      if (unquotedBodyMatch) {
        body = unquotedBodyMatch[1].trim();
      }
    }

    if (!subject) subject = "Pesan Baru";
    if (!body) {
      if (/formal|resmi|profesional/i.test(text)) {
        body = `Halo,\n\nMelalui pesan ini kami sampaikan informasi terkait ${subject}.\n\nDemikian kami sampaikan. Terima kasih.\n\nSalam hormat.`;
      } else {
        body = text;
      }
    }

    return { to, subject, body };
  }

  // Recovery parser natural language (fallback jika LLM jawab teks instruktif)
  function tryParseNaturalLanguageActions(text, userPrompt = "") {
    if (!text && !userPrompt) return null;
    const combined = `${text}\n${userPrompt}`;

    const navRegex = /(?:buka|kunjungi|pergi ke|navigate to|open|go to)\s+(?:website|halaman|situs)?\s*[`"']?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s`"']*)?|https?:\/\/[^\s`"']+)[`"']?/i;
    const searchRegex = /(?:cari|search|googling|temukan)\s+(?:di google|di internet|di tokopedia|di shopee|di amazon)\s*[:=]?\s*[`"']?([^`"'\n]+)[`"']?/i;

    const navMatch = combined.match(navRegex);
    if (navMatch) {
      let dest = navMatch[1].trim();
      if (!/^https?:\/\//i.test(dest)) dest = "https://" + dest;
      return {
        planner: { steps: [`1. Membuka alamat website ${dest}`] },
        action: "navigate",
        value: dest,
        url: dest,
        message: `Membuka website ${dest}...`
      };
    }

    const searchMatch = combined.match(searchRegex);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      let dest = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      let siteName = "Google";

      if (/tokopedia/i.test(combined)) {
        dest = `https://www.tokopedia.com/search?q=${encodeURIComponent(query)}`;
        siteName = "Tokopedia";
      } else if (/shopee/i.test(combined)) {
        dest = `https://shopee.co.id/search?keyword=${encodeURIComponent(query)}`;
        siteName = "Shopee";
      } else if (/amazon/i.test(combined)) {
        dest = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
        siteName = "Amazon";
      } else if (/riset|produk|harga|laptop|hp|beli|toko|spek|rekomendasi/i.test(combined) && !/di google/i.test(combined)) {
        dest = `https://www.tokopedia.com/search?q=${encodeURIComponent(query)}`;
        siteName = "Tokopedia";
      }

      return {
        planner: { steps: [`1. Membuka dan mencari "${query}" di ${siteName}`, `2. Mengekstrak data produk dan komparasi spesifikasi`] },
        action: "navigate",
        value: dest,
        url: dest,
        message: `Mencari "${query}" di ${siteName}...`
      };
    }

    // Email intent detection (e.g. kirim email ke X subjek Y pesan Z / buka compose di Gmail)
    const isEmailIntent = /(?:kirim|tulis|buat|draft|send|compose|buka compose)\s+(?:ke\s+|pesan\s+)?email|gmail/i.test(combined);
    const emailParams = extractEmailParameters(combined);

    if (isEmailIntent && emailParams.to) {
      return {
        planner: { steps: [`1. Membuka formulir compose Gmail`, `2. Mengisi penerima (${emailParams.to})`, `3. Mengisi subjek (${emailParams.subject})`, `4. Menuliskan isi pesan & menyelesaikan pengisian`] },
        action: "send_email",
        to: emailParams.to,
        subject: emailParams.subject,
        body: emailParams.body,
        sendNow: /(?:kirim sekarang|langsung kirim|auto send)/i.test(combined),
        message: `Mempersiapkan pengiriman email ke ${emailParams.to}...`
      };
    }

    // Social post intent detection (e.g. posting ke X / Twitter / medsos)
    const isSocialIntent = /(?:posting|post|tweet|unggah|publikasikan)\s+(?:ke\s+)?(?:x(?:\.com)?|twitter|medsos|media sosial)/i.test(combined) ||
                           /(?:coba\s+)?posting\s+tweet/i.test(combined);
    if (isSocialIntent) {
      return {
        planner: { steps: [`1. Membuka komposer postingan X (Twitter)`, `2. Menuliskan teks tweet`, `3. Menyiapkan postingan untuk ditinjau`] },
        action: "post_social",
        text: text || userPrompt,
        sendNow: /(?:langsung posting|langsung tweet|auto post|publish)/i.test(combined),
        message: `Mempersiapkan postingan ke X (Twitter)...`
      };
    }

    const lines = text.split('\n');
    const actions = [];

    const typeRegex = /(?:ketik|isi|tulis|masukkan|type|fill)\s+[`"']?([^`"'\n]+?)[`"']?\s+(?:pada|di|ke|into|in)\s+\[?(@e\d+|#\d+|\d+)\]?/i;
    const clickRegex = /(?:klik|tekan|pilih|click|press)\s+(?:tombol|button|link|menu)?\s*[`"']?([^`"'\n]+?)?[`"']?\s*(?:pada|di|ke)?\s*\[?(@e\d+|#\d+|\d+)\]?/i;

    for (const line of lines) {
      const tMatch = line.match(typeRegex);
      if (tMatch) {
        const rawId = tMatch[2];
        const normId = rawId.startsWith("@e") ? rawId : `@e${rawId.replace(/[^0-9]/g, '')}`;
        actions.push({ action: "type", value: tMatch[1].trim(), elementId: normId });
        continue;
      }
      const cMatch = line.match(clickRegex);
      if (cMatch) {
        const rawId = cMatch[2];
        const normId = rawId.startsWith("@e") ? rawId : `@e${rawId.replace(/[^0-9]/g, '')}`;
        actions.push({ action: "click", elementId: normId });
      }
    }

    if (actions.length > 0) {
      return {
        planner: { steps: actions.map((a, i) => `${i + 1}. ${a.action === 'type' ? `Isi "${a.value}"` : 'Klik'} pada [${a.elementId}]`) },
        actions,
        message: `Mengeksekusi ${actions.length} aksi otomatis yang teridentifikasi.`
      };
    }
    return null;
  }

  // ═══════════════════════════════════════════════════
  // RISK CLASSIFIER & CONFIRMATION GATE (Phase 7.1)
  // ═══════════════════════════════════════════════════
  const WRITE_SKILLS = ["skill_sheets_update", "skill_sheets_append", "skill_docs_append"];
  const RISKY_TEXT_RE = /(kirim|send|bayar|pay|pembayaran|hapus|delete|post|publish|checkout|order|beli\s|transfer|password|sandi|passwd)/i;

  function isRiskyAction(resObj) {
    const actionType = resObj.action || "";
    if (WRITE_SKILLS.includes(actionType)) return true;

    // Jika pengguna sudah secara eksplisit memerintahkan aksi di prompt awal (misal kirim email/post), jangan interupsi
    if (activeTask && /(?:kirim|send|buatkan|draft|tulis|post)\s+(?:email|pesan|surat|tweet|postingan|artikel)/i.test(activeTask.goal)) {
      return false;
    }

    const checkOne = (a) => {
      if (!a || typeof a !== "object") return false;
      const act = a.action || "";
      if (act === "click" && RISKY_TEXT_RE.test(`${a.message || ""} ${a.elementId || ""}`)) return true;
      if (act === "type" && /(password|sandi|passwd)/i.test(a.message || "")) return true;
      if (WRITE_SKILLS.includes(act)) return true;
      return false;
    };

    if (Array.isArray(resObj.actions)) {
      return resObj.actions.some(checkOne);
    }
    return checkOne(resObj);
  }

  function describeActionForConfirm(resObj) {
    const parts = [];
    const at = resObj.action || "batch";
    parts.push(`Aksi: ${at}`);
    if (resObj.message) parts.push(`Deskripsi: ${resObj.message}`);
    if (resObj.url || resObj.value) parts.push(`Nilai/URL: ${String(resObj.url || resObj.value || "").substring(0, 200)}`);
    if (Array.isArray(resObj.actions)) {
      parts.push(`Batch (${resObj.actions.length} aksi):`);
      resObj.actions.forEach((a, i) => parts.push(`  ${i + 1}. ${a.action} ${a.elementId || ""} ${a.value ? String(a.value).substring(0, 60) : ""}`));
    }
    return parts.join("\n");
  }

  function requestPlanApproval(planList, goalText) {
    return new Promise((resolve) => {
      planApprovalResolver = resolve;

      const planItemsHtml = planList.map((s, i) => `
        <div class="plan-approval-item">
          <span class="plan-approval-num">#${s.id || (i + 1)}</span>
          <span>${escapeHtml(s.description)}</span>
        </div>
      `).join("");

      const cardHtml = `
<div class="plan-approval-card" id="activePlanApprovalCard">
  <div class="plan-approval-header">
    <div style="display:flex; align-items:center; gap:6px;">
      <span>📋</span>
      <span>Persetujuan Rencana Tugas</span>
    </div>
    <span class="plan-approval-badge">Planning Mode</span>
  </div>
  <div class="plan-approval-sub">
    AI telah menyusun <strong>${planList.length} subtask</strong> untuk mencapai tujuan:
    <div style="color:#cbd5e1; font-weight:600; margin-top:3px;">"${escapeHtml(goalText)}"</div>
  </div>
  <div class="plan-approval-list">
    ${planItemsHtml}
  </div>
  <div class="plan-approval-actions">
    <button type="button" class="btn-approve-plan" id="btnApprovePlan">
      <span>🚀</span>
      <span>Setujui & Jalankan Rencana</span>
    </button>
    <button type="button" class="btn-reject-plan" id="btnRejectPlan">
      <span>Batalkan</span>
    </button>
  </div>
</div>
      `;

      addMessageToCurrentSession("assistant", cardHtml, { skipClean: true });

      setTimeout(() => {
        const approveBtn = document.getElementById("btnApprovePlan");
        const rejectBtn = document.getElementById("btnRejectPlan");
        const card = document.getElementById("activePlanApprovalCard");

        if (approveBtn) {
          approveBtn.addEventListener("click", () => {
            if (card) {
              const actionsRow = card.querySelector(".plan-approval-actions");
              if (actionsRow) {
                actionsRow.innerHTML = `<span style="color:#10b981; font-size:14px; font-weight:600; display:flex; align-items:center; gap:6px;">✅ Rencana Disetujui — Memulai Eksekusi...</span>`;
              }
            }
            if (planApprovalResolver) {
              planApprovalResolver(true);
              planApprovalResolver = null;
            }
          });
        }

        if (rejectBtn) {
          rejectBtn.addEventListener("click", () => {
            if (card) {
              const actionsRow = card.querySelector(".plan-approval-actions");
              if (actionsRow) {
                actionsRow.innerHTML = `<span style="color:#ef4444; font-size:14px; font-weight:600;">⛔ Rencana Dibatalkan</span>`;
              }
            }
            if (planApprovalResolver) {
              planApprovalResolver(false);
              planApprovalResolver = null;
            }
          });
        }
      }, 50);
    });
  }

  function requestConfirmation(resObj) {
    return new Promise((resolve) => {
      confirmResolver = resolve;
      if (activeTask) {
        activeTask.status = "WAITING_USER";
        refreshTaskCard();
        persistTask();
      }
      addMessageToCurrentSession("assistant", "", {
        skipClean: true,
        confirmation: {
          description: resObj.message || "Aksi berikut berpotensi mengubah data atau mengirim sesuatu:",
          detail: describeActionForConfirm(resObj),
          resolved: false
        }
      });
      appendLog(`🛡️ Menunggu konfirmasi user untuk aksi: ${resObj.action || "batch"}`, "WARN");
    });
  }

  // ═══════════════════════════════════════════════════
  // ASK_USER (Human-in-the-Loop dengan pause task)
  // ═══════════════════════════════════════════════════
  function requestAskUser(question, options) {
    return new Promise((resolve) => {
      askUserResolver = resolve;
      if (activeTask) {
        activeTask.status = "WAITING_USER";
        refreshTaskCard();
        persistTask();
      }
      addMessageToCurrentSession("assistant", question, {
        askUser: {
          question,
          options: Array.isArray(options) && options.length > 0 ? options : ["Ya, lanjutkan", "Batalkan"]
        }
      });
      appendLog(`🤔 Task dijeda — menunggu jawaban user: "${question}"`);
    });
  }

  // ═══════════════════════════════════════════════════
  // PAGE CONTEXT BUILDER
  // ═══════════════════════════════════════════════════
  async function scanPage(full = true) {
    const scanRes = await sendToContentScript({ type: "SCAN_DOM", showOverlay: Boolean(markersVisible) });
    if (!scanRes || !scanRes.success || !scanRes.data) {
      return {
        title: "?",
        url: "?",
        elementsCount: 0,
        reducedDOM: "(Halaman tidak dapat dipindai — mungkin halaman internal browser)",
        pageContent: ""
      };
    }
    return scanRes.data;
  }

  function buildPageContext(d, full, stepNum) {
    const errorBlock = Array.isArray(d.pageErrors) && d.pageErrors.length > 0
      ? `\n[ERROR RUNTIME/CONSOLE TERDETEKSI DI HALAMAN]\n${d.pageErrors.map(e => `- ${e}`).join("\n")}\n`
      : "";

    if (full) {
      return `
[INFORMASI WEB AKTIF]
Judul: ${d.title}
URL: ${d.url}
Jumlah Elemen Interaktif: ${d.elementsCount}
${errorBlock}
<untrusted_web_data source="${d.url}">
[KONTEN TEKS HALAMAN]
${(d.pageContent || "(Tidak ada konten teks utama)").substring(0, 3000)}

[DAFTAR ELEMEN SEMANTIK [@eN]]
${d.reducedDOM || "(Tidak ada elemen interaktif)"}
</untrusted_web_data>
      `.trim();
    }
    return `
[INFORMASI WEB AKTIF (Step ${stepNum})]
Judul: ${d.title} | URL: ${d.url} | Elemen: ${d.elementsCount}
${errorBlock}
<untrusted_web_data source="${d.url}">
[DAFTAR ELEMEN SEMANTIK TERKINI [@eN]]
${d.reducedDOM || "(Tidak ada elemen interaktif)"}
</untrusted_web_data>
    `.trim();
  }

  async function getTabsContext() {
    const res = await sendToBackground({ action: "LIST_TABS" }, 5000);
    if (res && res.success && Array.isArray(res.tabs)) {
      return "\n[DAFTAR TAB BROWSER]\n" + res.tabs.map(t => `${t.label} (id:${t.tabId}${t.active ? ", AKTIF" : ""}): ${t.title} — ${t.url.substring(0, 90)}`).join("\n");
    }
    return "";
  }

  // ═══════════════════════════════════════════════════
  // SCREENSHOT (Phase 3)
  // ═══════════════════════════════════════════════════
  async function captureScreenshot() {
    if (!visionEnabled) return null;
    const res = await sendToBackground({ action: "SCREENSHOT" }, 8000);
    if (res && res.success && res.dataUrl) {
      return res.dataUrl;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════
  // ACTION DISPATCHER (route: DOM / background / skills / clipboard / artifact)
  // ═══════════════════════════════════════════════════
  function detectTargetSocialPlatform(text = "", currentUrl = "") {
    const s = String(text || "").toLowerCase();
    const u = String(currentUrl || "").toLowerCase();

    if (/threads(?:\.net|\.com)?|\bthreads\b/i.test(s) || u.includes("threads.net")) {
      return {
        platform: "threads",
        name: "Threads",
        url: "https://www.threads.net",
        domainCheck: /threads\.net/i
      };
    }
    if (/linkedin(?:\.com)?|\blinkedin\b/i.test(s) || u.includes("linkedin.com")) {
      return {
        platform: "linkedin",
        name: "LinkedIn",
        url: "https://www.linkedin.com/feed/",
        domainCheck: /linkedin\.com/i
      };
    }
    if (/facebook(?:\.com)?|\bfacebook\b|\bfb(?:\.com)?\b/i.test(s) || u.includes("facebook.com")) {
      return {
        platform: "facebook",
        name: "Facebook",
        url: "https://www.facebook.com",
        domainCheck: /facebook\.com/i
      };
    }
    return {
      platform: "twitter",
      name: "X (Twitter)",
      url: "https://x.com/compose/post",
      domainCheck: /x\.com|twitter\.com/i
    };
  }

  async function executeAgentAction(resObj) {
    const isBatch = Array.isArray(resObj.actions) && resObj.actions.length > 0;
    let actionType = isBatch ? "batch" : (resObj.action || resObj.navigator?.action || "");

    // Normalisasi nama
    if (actionType === "navigate_to") actionType = "navigate";
    if (actionType === "search" || actionType === "google") {
      actionType = "navigate";
      resObj.url = `https://www.google.com/search?q=${encodeURIComponent(resObj.value || activeTask?.goal || "")}`;
    }
    if (actionType === "type_text" || actionType === "fill") actionType = "type";
    if (actionType === "click_element") actionType = "click";
    if (actionType === "finish_task") actionType = "finish";
    if (/(?:insert_table|create_table|sisipkan.*tabel|buat.*tabel|isi.*tabel)/i.test(actionType)) {
      actionType = "paste_text";
      if (!resObj.value && !resObj.text) {
        resObj.value = resObj.table || resObj.data || activeTask?.goal || resObj.message || "";
      }
    }

    // Recovery navigate tanpa value
    if (actionType === "navigate") {
      let navUrl = resObj.url || resObj.value;
      if (!navUrl || typeof navUrl !== "string" || !navUrl.trim() || navUrl === "undefined") {
        const navInText = (resObj.message || activeTask?.goal || "").match(/(?:https?:\/\/[^\s`"']+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (navInText) {
          let dest = navInText[0].trim();
          if (!dest.includes(".")) dest = dest + ".com";
          navUrl = /^https?:\/\//i.test(dest) ? dest : `https://${dest}`;
        } else if (activeTask?.goal) {
          navUrl = `https://www.google.com/search?q=${encodeURIComponent(activeTask.goal)}`;
        }
      }
      resObj.url = navUrl;
      resObj.value = navUrl;
    }

    const result = { actionType };

    // ── Aksi tanpa eksekusi halaman ──
    if (actionType === "finish") {
      result.success = true;
      result.isFinished = true;
      result.message = resObj.message || "Tugas telah selesai dikerjakan!";
      return result;
    }

    if (actionType === "ask_user" || resObj.question) {
      result.success = true;
      result.isAskUser = true;
      result.question = resObj.question || "Silakan pilih tindakan:";
      result.options = resObj.options;
      return result;
    }

    if (actionType === "artifact") {
      const artifact = {
        artifactType: resObj.artifactType || "text",
        name: resObj.name || `artifact-${Date.now()}`,
        content: resObj.content || resObj.value || ""
      };
      addMessageToCurrentSession("assistant", `📦 Artefak **${artifact.name}** berhasil dibuat.`, { skipClean: false, artifact });
      if (activeTask) {
        activeTask.artifacts.push(artifact);
        persistTask();
      }
      result.success = true;
      result.message = `Artefak "${artifact.name}" dibuat.`;
      return result;
    }

    if (actionType === "write_clipboard") {
      try {
        await navigator.clipboard.writeText(String(resObj.value ?? ""));
        result.success = true;
        result.message = `Teks (${String(resObj.value || "").length} karakter) disalin ke clipboard.`;
      } catch (err) {
        result.success = false;
        result.error = `Clipboard gagal: ${err.message}`;
      }
      return result;
    }

    // ── Eksekusi Modular Skills (skills.sh Registry) ──
    if (globalThis.PesatSkillRegistry?.findSkillForTool?.(actionType)) {
      appendLog(`🛠️ Mengeksekusi skill '${actionType}'...`);
      const skillRes = await globalThis.PesatSkillRegistry.executeSkill(actionType, resObj, {
        sendToContentScript,
        sendToBackground,
        appendLog,
        showStatusIndicator
      });
      result.success = !!(skillRes && skillRes.success !== false);
      result.message = skillRes?.message || skillRes?.error || `Skill ${actionType} dieksekusi.`;
      result.stateChanged = skillRes?.stateChanged !== false;
      Object.assign(result, skillRes);
      return result;
    }

    // ── Aksi otomatisasi Email Khusus (Gmail / Webmail) ──
    if (actionType === "send_email" || actionType === "compose_email") {
      let currentTab = null;
      try {
        const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
        if (tabs && tabs[0]) currentTab = tabs[0];
      } catch (e) {}

      const isAlreadyOnGmail = currentTab && /mail\.google\.com/i.test(currentTab.url || "");

      if (!isAlreadyOnGmail) {
        appendLog("Membuka halaman Gmail...");
        showStatusIndicator("Membuka formulir Tulis Gmail...");
        await sendToBackground({ action: "NAVIGATE_TAB", url: "https://mail.google.com/mail/u/0/#inbox?compose=new" });
        await new Promise(r => setTimeout(r, 4500));
        await sendToContentScript({ type: "WAIT_FOR_DOM_STABLE", maxWaitMs: 3000, stableWindowMs: 600 }, 5000).catch(() => {});
      }

      showStatusIndicator("Mengisi formulir email di Gmail...");
      const r = await sendToContentScript({
        type: "EXECUTE_ACTION",
        actionData: {
          action: "send_email",
          to: resObj.to || resObj.recipient,
          subject: resObj.subject,
          body: resObj.body || resObj.message || resObj.value,
          sendNow: resObj.sendNow === true
        }
      }, 25000);

      result.success = !!(r && r.success);
      result.message = (r && (r.message || r.error)) || "Email berhasil diproses.";
      result.stateChanged = true;
      result.isFinished = true;
      return result;
    }

    // ── Aksi otomatisasi Media Sosial Khusus (Twitter/X, Threads, LinkedIn, Facebook) ──
    if (actionType === "post_social" || actionType === "post_twitter" || actionType === "post_x" || actionType === "tweet" || actionType === "social_post" || actionType === "post_threads") {
      let currentTab = null;
      try {
        const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
        if (tabs && tabs[0]) currentTab = tabs[0];
      } catch (e) {}

      const targetPlatform = detectTargetSocialPlatform(
        `${resObj.platform || ""} ${resObj.target || ""} ${activeTask?.goal || ""} ${resObj.text || ""}`,
        currentTab?.url || ""
      );

      const isAlreadyOnSocial = currentTab && targetPlatform.domainCheck.test(currentTab.url || "");
      if (!isAlreadyOnSocial) {
        appendLog(`Navigasi ke ${targetPlatform.name}...`);
        showStatusIndicator(`Membuka halaman ${targetPlatform.name}...`);
        await sendToBackground({ action: "NAVIGATE_TAB", url: targetPlatform.url });
        await new Promise(r => setTimeout(r, 4500));
        await sendToContentScript({ type: "WAIT_FOR_DOM_STABLE", maxWaitMs: 4000, stableWindowMs: 800 }, 6000).catch(() => {});
      }

      showStatusIndicator(`Menuliskan draf postingan di ${targetPlatform.name}...`);
      const postText = resObj.text || resObj.body || resObj.message || resObj.value || "";
      const r = await sendToContentScript({
        type: "EXECUTE_ACTION",
        actionData: {
          action: "post_social",
          text: postText,
          sendNow: resObj.sendNow === true || resObj.postNow === true
        }
      }, 20000);

      result.success = !!(r && r.success);
      result.message = (r && (r.message || r.error)) || `Postingan di ${targetPlatform.name} berhasil diproses.`;
      result.stateChanged = true;
      result.isFinished = true;
      return result;
    }

    // ── Aksi via background / direct tabs ──
    if (actionType === "navigate") {
      const r = await navigateToUrl(resObj.url || resObj.value);
      result.success = !!r.success;
      result.message = r.message || r.error;
      result.raw = r;

      // Auto-wait setelah navigasi: halaman baru harus termuat sebelum langkah berikutnya
      if (result.success) {
        showStatusIndicator();
        await new Promise(r2 => setTimeout(r2, 1500));
        await sendToContentScript(
          { type: "WAIT_FOR_DOM_STABLE", maxWaitMs: 3500, stableWindowMs: 700 },
          6000
        );
      }
      return result;
    }

    if (["new_tab", "switch_tab", "close_tab", "list_tabs", "screenshot", "download_file"].includes(actionType)) {
      let r;
      if (actionType === "new_tab") {
        r = await sendToBackground({ action: "NEW_TAB", url: resObj.url || resObj.value });
        if (r && r.success) {
          await new Promise(res => setTimeout(res, 800));
          await sendToContentScript({ type: "LOCK_PAGE", message: "Tab baru sedang dikontrol oleh Pesat AI Agent..." }).catch(() => {});
        }
      }
      else if (actionType === "switch_tab") {
        await sendToContentScript({ type: "UNLOCK_PAGE" }).catch(() => {});
        r = await sendToBackground({ action: "SWITCH_TAB", matchTitle: resObj.matchTitle, matchUrl: resObj.matchUrl, tabId: resObj.tabId });
        if (r && r.success) {
          await new Promise(res => setTimeout(res, 600));
          await sendToContentScript({
            type: "LOCK_PAGE",
            message: `Tab ${resObj.matchTitle || "ini"} sedang dikontrol oleh Pesat AI Agent...`
          }).catch(() => {});
        }
      }
      else if (actionType === "close_tab") r = await sendToBackground({ action: "CLOSE_TAB", tabId: resObj.tabId });
      else if (actionType === "list_tabs") r = await sendToBackground({ action: "LIST_TABS" });
      else if (actionType === "screenshot") {
        const shot = await captureScreenshot();
        result.success = !!shot;
        result.screenshotDataUrl = shot;
        result.message = shot ? "Screenshot halaman aktif berhasil diambil." : "Screenshot gagal diambil.";
        if (shot) result.data = { note: "Screenshot dikirim pada panggilan AI berikutnya." };
        return result;
      }
      else if (actionType === "download_file") {
        r = await sendToBackground({
          action: "DOWNLOAD_FILE",
          params: {
            filename: resObj.filename || resObj.name || `pesat-file-${Date.now()}.txt`,
            content: resObj.content || resObj.value || "",
            mimeType: resObj.mimeType || "text/plain"
          }
        });
      }
      result.success = !!(r && r.success);
      result.message = (r && (r.message || r.error)) || "";
      result.data = r?.tabs || r?.data || null;
      return result;
    }

    if (actionType.startsWith("skill_")) {
      const params = { ...resObj };
      delete params.action;
      delete params.message;
      delete params.planner;
      const r = await sendToBackground({ action: "EXECUTE_SKILL", skill: actionType, params });
      result.success = !!(r && r.success);
      result.message = (r && (r.message || r.error)) || "";
      result.data = r?.data || null;
      result.needsAuth = !!r?.needsAuth;
      result.isLoopDetected = !!r?.isLoopDetected;
      return result;
    }

    // ── Aksi DOM via content script ──
    let actionData;
    if (isBatch) {
      actionData = { actions: resObj.actions.map(act => ({ ...act, elementId: act.elementId || act.target })) };
    } else {
      actionData = {
        action: actionType,
        elementId: resObj.elementId || resObj.navigator?.elementId,
        targetText: resObj.targetText || resObj.fallbackText || resObj.text || resObj.label || "",
        fallbackText: resObj.fallbackText || resObj.targetText || resObj.text || "",
        value: resObj.value ?? resObj.text,
        pressEnter: resObj.pressEnter,
        keys: resObj.keys || resObj.key,
        key: resObj.key,
        selector: resObj.selector,
        scrollDirection: resObj.scrollDirection || resObj.direction,
        x: resObj.x,
        y: resObj.y,
        fromElementId: resObj.fromElementId,
        toElementId: resObj.toElementId,
        fileName: resObj.fileName,
        contentText: resObj.contentText,
        contentBase64: resObj.contentBase64,
        mimeType: resObj.mimeType
      };
    }

    const r = await sendToContentScript({ type: "EXECUTE_ACTION", actionData });
    result.success = !!(r && r.success);
    result.message = (r && (r.message || r.error)) || "";
    result.stateChanged = !!r?.stateChanged || (Array.isArray(r?.batchResults) && r.batchResults.some(item => item.stateChanged));
    result.isLoopDetected = !!r?.isLoopDetected;
    result.suggestion = r?.suggestion;

    // Auto-wait setelah aksi penting
    if (result.success && (actionType === "navigate" || actionType === "click" || isBatch)) {
      const waitMs = actionType === "navigate" ? 2000 : 600;
      showStatusIndicator();
      await new Promise(r2 => setTimeout(r2, actionType === "navigate" ? 800 : 150));
      await sendToContentScript({
        type: "WAIT_FOR_DOM_STABLE",
        maxWaitMs: waitMs,
        stableWindowMs: actionType === "navigate" ? 400 : 250
      });
    }

    return result;
  }

  // ═══════════════════════════════════════════════════
  // VALIDATOR (Phase 4)
  // ═══════════════════════════════════════════════════
  async function runValidator(lastAction, lastResult, pageAfter) {
    const sub = currentSubtaskObj();
    const safeActionType = lastAction?.actionType || lastAction?.action || lastAction?.type || "unknown";

    // Jika eksekusi aksi gagal, validator langsung kembalikan RETRY tanpa meloloskan ke DONE
    if (lastResult !== "success") {
      return {
        verdict: "RETRY",
        subtaskComplete: false,
        reason: `Aksi '${safeActionType}' mengalami kegagalan eksekusi: ${lastAction?.message || "Error interaksi DOM"}`
      };
    }

    const isNavOrMenu = /(?:buka|klik|pilih|masuk|tampilkan|kunjungi|navigate|open|click)\s+(?:ke\s+)?(?:menu|sidebar|halaman|tab)?/i.test(sub?.description || activeTask?.goal || "");
    const isSingleStepGoal = (activeTask?.plan?.length || 0) <= 1;

    // Fast-path deterministik: Jika aksi adalah klik menu atau navigasi dan sukses, selesaikan subtask langsung
    if (isNavOrMenu && (safeActionType === "click" || safeActionType === "navigate")) {
      return {
        verdict: isSingleStepGoal ? "DONE" : "SUCCESS",
        subtaskComplete: true,
        reason: "Menu atau navigasi target berhasil diklik dan dibuka."
      };
    }

    const prompt = `
[AKSI TERAKHIR]
Subtask aktif: #${sub ? sub.id : 1} — ${sub ? sub.description : activeTask?.goal || ""}
Aksi yang dijalankan: ${safeActionType}
Hasil eksekusi: BERHASIL (${lastAction?.message || "Sukses"})

[KONDISI HALAMAN SAAT INI]
Judul: ${pageAfter?.title || ""}
URL: ${pageAfter?.url || ""}
Elemen terdeteksi: ${pageAfter?.elementsCount || 0}
Struktur elemen terkini (8 baris pertama):
${(pageAfter?.reducedDOM || "").split("\n").slice(0, 8).join("\n")}

[INSTRUKSI VALIDATOR]
Tentukan apakah subtask di atas telah berhasil diselesaikan berdasarkan hasil aksi tersebut.
Jika aksi adalah membuka menu/link/navigasi atau mengisi form yang berhasil:
Tetapkan "verdict": "DONE" dan "subtaskComplete": true.

Respon HANYA dalam format JSON valid:
{
  "verdict": "DONE" | "CONTINUE" | "RETRY",
  "subtaskComplete": true | false,
  "reason": "Penjelasan singkat hasil evaluasi"
}
`.trim();

    try {
      const reply = await callLLM("validate", prompt);
      const parsed = parseActionJSON(reply);
      if (parsed && parsed.verdict) {
        return {
          verdict: String(parsed.verdict).toUpperCase(),
          subtaskComplete: !!parsed.subtaskComplete,
          reason: parsed.reason || ""
        };
      }
    } catch (err) {
      appendLog(`Validator error: ${err.message}`, "WARN");
    }

    // Fallback: Jika aksi sukses, anggap subtask selesai jika tidak ada bukti kegagalan
    return {
      verdict: isSingleStepGoal ? "DONE" : "SUCCESS",
      subtaskComplete: true,
      reason: "Aksi sukses dijalankan."
    };
  }

  // ═══════════════════════════════════════════════════
  // MAIN: TASK EXECUTION LOOP (BYOK Gate Checked)
  // ═══════════════════════════════════════════════════
  async function handleSend() {
    const userPrompt = promptInput.value.trim();
    if (!userPrompt || isAgentRunning) return;

    // GERBANG BYOK (PLAN Phase A.3): Cek apakah API key sudah ada
    if (!isConfigured()) {
      showByokGateMessage();
      return;
    }

    const contextSourcesToSend = [...attachedContextSources];
    attachedContextSources = [];
    renderComposerChips();

    // Auto-detect dan resolve mention tab inline (misal "@tab1", "@tab2") jika diketik langsung oleh user
    const tabMentions = userPrompt.match(/@tab(\d+)/gi);
    if (tabMentions && typeof chrome !== "undefined" && chrome.tabs) {
      try {
        const allTabs = await new Promise(res => chrome.tabs.query({ currentWindow: true }, res));
        for (const tm of tabMentions) {
          const tIdx = parseInt(tm.replace(/@tab/i, ""), 10);
          if (tIdx >= 1 && tIdx <= allTabs.length) {
            const targetTab = allTabs[tIdx - 1];
            if (!contextSourcesToSend.some(s => s.metadata?.tabId === targetTab.id || s.id === `tab-${targetTab.id}`)) {
              contextSourcesToSend.push({
                id: `tab-${targetTab.id}`,
                tabId: targetTab.id,
                name: `tab${tIdx}`,
                title: `[@tab${tIdx}] ${targetTab.title || "Tab"}`,
                url: targetTab.url || "",
                type: "BrowserTab",
                metadata: {
                  tabId: targetTab.id,
                  title: targetTab.title,
                  url: targetTab.url,
                  index: tIdx
                }
              });
            }
          }
        }
      } catch (err) {
        console.warn("[Sidepanel] Inline @tab resolve error:", err);
      }
    }

    promptInput.value = "";
    promptInput.style.height = "38px";
    shouldStopAgent = false;

    // Pastikan state task sebelumnya bersih saat prompt baru dikirim oleh user
    if (!isAgentRunning) {
      activeTask = null;
      clearPersistedTask();
    }

    chrome.runtime.sendMessage({ action: "RESET_LOOP_TRACKER" }, () => {
      if (chrome.runtime.lastError) {}
    });

    let displayPrompt = userPrompt;
    if (contextSourcesToSend.length > 0) {
      const extraChips = contextSourcesToSend
        .filter(s => s && s.name && (s.type === "File" || s.type === "Image" || !userPrompt.includes(`@${s.name}`)))
        .map(s => s.type === "BrowserTab" ? `@${s.name}` : (s.type === "Connector" ? `@${s.name}` : `📎 ${s.name}`))
        .filter(c => c && !c.includes("undefined"));
      if (extraChips.length > 0) {
        displayPrompt = `${extraChips.join(" ")}\n${userPrompt}`;
      }
    }
    addMessageToCurrentSession("user", displayPrompt);

    // Deteksi Koreksi Percakapan (misal: "loh carinya di cnn.com itu donk tadinya bukanya di cnn.com")
    const correctionMatch = userPrompt.match(/(?:carinya\s+di|bukanya\s+di|maksud\s+saya\s+di|harus\s+di|pindah\s+ke)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_-]+)/i);
    if (correctionMatch) {
      let targetSite = correctionMatch[1].trim();
      if (!targetSite.includes(".")) targetSite += ".com";
      if (!targetSite.startsWith("http")) targetSite = "https://" + targetSite;

      appendLog(`🔄 Koreksi pengguna diterima: mengarahkan kembali ke ${targetSite}`);
      showStatusIndicator(`Membuka kembali ${targetSite}...`);
      await navigateToUrl(targetSite);
      await new Promise(r => setTimeout(r, 1200));
      addMessageToCurrentSession("assistant", `✅ Mengerti, saya telah mengarahkan kembali ke **${targetSite}**. Silakan beritahu apa yang ingin dicari atau dikerjakan di sini.`);
      return;
    }

    // Deteksi cerdas antara Perintah Aksi Fisik di Web vs Pembuatan Konten/Artikel/Analisis Langsung
    const isDocsTarget = /(?:(?:google|goole|g)\s*docs?|docs\.new|docs\.google\.com|gdocs?|(?:buka|ke|di|dalam|pada)\s+(?:(?:google|goole|g)\s*)?docs?|(?:google|goole)\s*dokumen|lembar\s*kerja\s*dokumen|editor\s*dokumen)/i.test(userPrompt);
    const hasTableCreation = /(?:buatkan tabel|buat tabel|bikin tabel|tabel data|isi data|tabel komparasi|data penjualan|tabel\b)/i.test(userPrompt);

    const isSpreadsheetAction = !isDocsTarget && (
      /(?:spreadsheet|google sheets?|sheets\.new|ke dalam spreadsheet|ke spreadsheet|di spreadsheet|isi spreadsheet|tabel spreadsheet|buatkan spreadsheet)/i.test(userPrompt) ||
      hasTableCreation
    );

    const isEmailAction = /(?:email|gmail|kirim\s+(?:ke|email)|compose|pesan\s+baru)/i.test(userPrompt);
    const isFormAction = !isSpreadsheetAction && !isDocsTarget && /(?:isi\s+form|isi\s+formulir|isi\s+field|\blogin\b|\bsign\s*in\b|\bmasuk\s+(?:ke|akun)\b|autofill|isi\s+email|isi\s+password|isi\s+kolom|masukkan\s+email|masukkan\s+password|isi\s+akun)/i.test(userPrompt);

    const isContentOrWriting = !isEmailAction && !isFormAction && (
      isSpreadsheetAction ||
      isDocsTarget ||
      hasTableCreation ||
      /(?:buatkan|tuliskan|tulis|buat|draft|ketik|isi|generate|ceritakan|cerita|bahas|ulas|jelaskan|paparkan)\s+(?:(?:\d+\s+)?(?:paragraf|kalimat|artikel|surat|konten|esai|tulisan|laporan|draf|copywriting|catatan|cerita|tabel|teori)|tentang|mengenai)/i.test(userPrompt) ||
      /(?:buatkan artikel|tulis artikel|buat artikel|artikel edukasi|buatkan draf artikel|buat draf artikel|surat penawaran|rangkum|ringkas|summarize|ringkasan|rangkuman|analisis seo|audit seo|audit keamanan|keamanan web|salin seluruh teks)/i.test(userPrompt) ||
      /(?:tulis|ketik|isi|buat|bahas).*di\s+(?:google\s+docs|goole\s+docs|docs|dokumen|lembar\s+kerja)/i.test(userPrompt) ||
      // Deteksi eksplisit permintaan N paragraf atau cerita pendek
      /\d+\s+(?:paragraf|kalimat|bait|bab)/i.test(userPrompt) ||
      /(?:cerita\s+(?:pendek|singkat|fiksi|rakyat|dongeng)|prosa|puisi|narasi)/i.test(userPrompt)
    );

    const hasPhysicalActionVerb = isEmailAction || isFormAction || (!isContentOrWriting && (
      /(?:^(?:buka|kunjungi|open|go to|navigate to|kirim|send|klik|click|select|pilih|hapus|delete|upload|download|login|masuk|daftar|register|pesan|checkout|scroll|jalankan|posting|post|isi|fill|ketik|masukkan|input|autofill)\b)/i.test(userPrompt) ||
      /(?:(?:dan|lalu|kemudian)\s+(?:buka|kirim|klik|pilih|posting|post|isi|ketik|masukkan))/i.test(userPrompt) ||
      /(?:buka tab|buka x\.com|buka twitter|buka gmail|buka linkedin|posting ke|post ke|tweet ke|isi form|isi email|isi password)/i.test(userPrompt)
    ));

    const isDirectAnalysisOnly = !isEmailAction && !isFormAction && (isContentOrWriting || (!hasPhysicalActionVerb && (
      /(?:^(?:apa|apakah|siapa|bagaimana|mengapa|kenapa|dimana|berapa|kapan|jelaskan|terangkan|ceritakan|sebutkan|tolong jelaskan|info|informasi|what|who|how|why|where|when|which|is this|explain|tell me|ini apa|ini platform apa|ini website apa|halaman apa ini)\b)/i.test(userPrompt) ||
      /\?$/.test(userPrompt)
    )));

    if (isDirectAnalysisOnly) {
      await runAnalysisFlow(userPrompt, contextSourcesToSend);
      return;
    }

    await startTask(userPrompt, contextSourcesToSend);
  }

  function parseMarkdownTable(markdown = "") {
    if (!markdown) return null;
    const lines = String(markdown).split("\n").map(l => l.trim()).filter(l => l.startsWith("|"));
    if (lines.length < 2) return null;

    const rows = [];
    for (const line of lines) {
      if (/^\|[-:\s|]+\|$/.test(line)) continue; // Skip separator row (|---|---|)
      const cells = line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(c => c.trim());

      if (cells.some(c => c.length > 0)) {
        rows.push(cells);
      }
    }

    return rows.length > 0 ? rows : null;
  }

  async function runAnalysisFlow(userPrompt, contextSources = []) {
    // Guard: Jika ada proses analisis/task yang sedang berjalan, tolak pemanggilan ganda
    if (isAgentRunning) {
      appendLog("⚠️ Analisis sudah berjalan, permintaan duplikat diabaikan.", "WARN");
      return;
    }
    try {
      setAgentRunning(true);
      showStatusIndicator();
      appendLog("Mengambil data halaman web untuk menjawab...");

      let activeTabInfo = null;
      try {
        const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
        if (tabs && tabs[0]) activeTabInfo = tabs[0];
      } catch (_) {}

      // 0. Ekstraksi Dokumen / File Lampiran Pengguna
      const attachedFiles = (contextSources || []).filter(s => s && (s.type === "File" || s.type === "Image" || s.type === "Download" || s.content || s.metadata?.extractedText || s.metadata?.content));
      let fileContextBlock = "";
      if (attachedFiles.length > 0) {
        fileContextBlock = attachedFiles.map((f, idx) => {
          const content = f.content || f.metadata?.content || f.metadata?.extractedText || f.metadata?.fullText || "";
          return `[DOKUMEN TERLAMPIR #${idx + 1}: ${f.name || f.title || "File"} (${f.metadata?.sizeFormatted || f.type})]\n${content}`;
        }).join("\n\n");
        appendLog(`📎 Mengikutsertakan ${attachedFiles.length} file terlampir ke dalam analisis: ${attachedFiles.map(f => f.name).join(", ")}`);
      }

      // 1. Cek apakah ada referensi BrowserTab yang dilampirkan atau di-mention (@tab1, @tab2, dll.)
      const referencedTab = (contextSources || []).find(s => s && (s.type === "BrowserTab" || s.type === "tab") && s.metadata?.tabId);

      let cleanText = "";
      let pageTitle = (attachedFiles[0]?.name) || activeTabInfo?.title || "Halaman Web";
      let pageUrl = activeTabInfo?.url || "";

      if (referencedTab && referencedTab.metadata?.tabId) {
        appendLog(`📖 Membaca referensi dari [${referencedTab.name || 'Tab'}] ${referencedTab.metadata.title || referencedTab.title}...`);
        const tabTextRes = await sendToBackground({
          action: "GET_READABLE_TEXT",
          tabId: referencedTab.metadata.tabId
        });
        if (tabTextRes && tabTextRes.text && tabTextRes.text.length > 20) {
          cleanText = tabTextRes.text;
          pageTitle = tabTextRes.title || referencedTab.metadata.title || referencedTab.name;
          pageUrl = tabTextRes.url || referencedTab.metadata.url || "";
        }
      }

      // Jika belum ada cleanText dari referensi tab dan tidak ada file, ambil dari tab aktif saat ini
      if (!cleanText && (!fileContextBlock || (!pageUrl.startsWith("chrome://") && !pageUrl.startsWith("about:")))) {
        const textRes = await sendToContentScript({ type: "GET_READABLE_TEXT" });
        const webText = textRes?.text || "";
        if (webText && webText.length > 20) {
          cleanText = webText;
          pageTitle = activeTabInfo?.title || textRes?.title || pageTitle;
          pageUrl = activeTabInfo?.url || textRes?.url || pageUrl;
        } else if (!fileContextBlock) {
          const scanFallback = await sendToContentScript({ type: "SCAN_DOM", showOverlay: false });
          cleanText = scanFallback?.data?.pageContent || "";
          pageTitle = activeTabInfo?.title || scanFallback?.data?.title || pageTitle;
          pageUrl = activeTabInfo?.url || scanFallback?.data?.url || pageUrl;
        }
      }

      if (fileContextBlock) {
        cleanText = `${fileContextBlock}\n\n${cleanText ? `[KONTEKS HALAMAN WEB]:\n${cleanText}` : ""}`.trim();
      }

      const isSheetsSite = pageUrl.includes("/spreadsheets") ||
                           pageTitle.includes("Google Spreadsheet") ||
                           pageTitle.includes("Google Sheets") ||
                           pageTitle.includes("Excel") ||
                           pageUrl.includes("excel.office.com");

      const isDocsSite = (pageUrl.includes("docs.google.com") && !pageUrl.includes("/spreadsheets")) ||
                         pageTitle.includes("Google Dokumen") ||
                         pageTitle.includes("Google Docs") ||
                         pageUrl.includes("word.office.com");

      const userExplicitDocs = /(?:google\s+docs?|docs\.new|di docs|ke docs|dalam.*docs|google\s+dokumen|di dokumen|ke dokumen|dalam.*dokumen|lembar kerja)/i.test(userPrompt);
      const userExplicitSheets = /(?:spreadsheet|google sheets?|sheets\.new|ke dalam spreadsheet|ke spreadsheet|di spreadsheet|isi spreadsheet|buatkan spreadsheet)/i.test(userPrompt);
      const isDocsTarget = userExplicitDocs || isDocsSite;

      // Klasifikasi Intent yang Akurat (Prioritas: Summarize / SEO / Security / Social / Table Docs / Table Sheets / Table General / Docs Article / Product / Article / QA)
      const isSummarize = /(?:rangkum|ringkas|summarize|ringkasan|rangkuman)/i.test(userPrompt);
      const isSeo = !isSummarize && /(?:seo|meta|kata kunci|keyword)/i.test(userPrompt);
      const isSecurity = !isSummarize && /(?:keamanan|security|audit keamanan|ssl|https)/i.test(userPrompt);
      const isSocialThread = !isSummarize && !isDocsTarget && /(?:thread|tweet|twitter|x\.com|medsos|postingan|linkedin|caption|feed|sosmed)/i.test(userPrompt);
      const isSocialCopywritingForDocs = !isSummarize && isDocsTarget && /(?:sosmed|media sosial|copywriting|thread|tweet|postingan|caption|feed|carousel|konten)/i.test(userPrompt);

      const hasTableCreationIntent = /(?:buatkan tabel|buat tabel|bikin tabel|tabel data|isi data|tabel komparasi|data penjualan|tabel\b)/i.test(userPrompt);

      // 1. isDocsTableTask: jika tujuannya Google Docs dan ada perintah membuat tabel
      const isDocsTableTask = !isSummarize && !isSeo && !isSecurity && !isSocialThread && isDocsTarget && hasTableCreationIntent;

      // 2. isSpreadsheetTask: jika pengguna eksplisit meminta Sheets atau sedang berada di tab Sheets
      const isSpreadsheetTask = !isSummarize && !isSeo && !isSecurity && !isSocialThread && !isDocsTableTask && (
        userExplicitSheets || (isSheetsSite && hasTableCreationIntent)
      );

      // 3. isGeneralTableTask: jika pengguna meminta tabel tapi bukan khusus Google Docs dan bukan khusus Google Sheets
      const isGeneralTableTask = !isSummarize && !isSeo && !isSecurity && !isSocialThread && !isDocsTableTask && !isSpreadsheetTask && hasTableCreationIntent;

      const isProductResearch = !isSummarize && !isSpreadsheetTask && !isDocsTableTask && !isGeneralTableTask && !isSocialThread && /(?:riset produk|laptop|harga|rekomendasi produk|komparasi|spesifikasi|cari produk|tokopedia|shopee|produk)/i.test(userPrompt);

      // 4. isDocsArticleTask: jika tujuannya Google Docs dan meminta artikel/berita/top N/copywriting
      const isDocsArticleTask = !isSummarize && !isSpreadsheetTask && !isDocsTableTask && isDocsTarget && (
        isSocialCopywritingForDocs || /(?:artikel|tulis|buatkan|paragraf|berita|top\s*\d+|blog post|esai|tulisan|draf|dokumen|konten|surat)/i.test(userPrompt)
      );

      const isArticle = !isSummarize && !isSpreadsheetTask && !isDocsTableTask && !isDocsArticleTask && !isGeneralTableTask && !isSocialThread && !isProductResearch && /(?:artikel|tulis|buatkan|paragraf|berita|top\s*\d+|blog post|esai|tulisan|draf|dokumen|konten|surat)/i.test(userPrompt);

      let promptPayload = "";
      if (isDocsTableTask) {
        const isDocsOrWordEditor = isDocsSite || pageUrl.includes("docs.google.com") || pageUrl.includes("office.com");
        const refSnippet = (!isDocsOrWordEditor && cleanText && cleanText.length > 50)
          ? `\n\n[REFERENSI DOKUMEN / SUMBER WEB]:\nJudul: ${pageTitle}\n${cleanText.substring(0, 2500)}`
          : "";

        promptPayload = `Bertindaklah sebagai MASTER DOCUMENT DESIGNER & SENIOR DATA ANALYST (Standar Dokumen Eksekutif Google Docs & Microsoft Word).

[PERINTAH PEMBUATAN TABEL DI DOKUMEN]:
${userPrompt}${refSnippet}

PEDOMAN KETAT TABEL DOKUMEN GOOGLE DOCS:
1. SAJIKAN TABEL DALAM FORMAT MARKDOWN TABLE RESMI:
   - Header kolom dan setiap sel harus secara presisi, akurat, dan lengkap menjawab topik perintah pengguna (contoh untuk daftar perusahaan/finansial: | No | Nama Perusahaan | Sektor / Industri | Estimasi Kekayaan / Valuasi Pasar (2026) | Catatan / Aset Utama |).
   - Seluruh baris data harus diisi lengkap dengan data yang realistis dan faktual (DILARANG menggunakan placeholder [...] atau template kosong).
   - DILARANG membubuhkan tanda khusus Markdown seperti bintang ganda (**), asterisk (*), atau backtick di dalam sel tabel (tulis langsung teks atau nilainya secara bersih, contoh: tulis 'Total' bukan '**Total**', tulis '4.260 Triliun' bukan '**4.260 Triliun**').
   - Sertakan baris Total / Rata-rata di bagian paling bawah jika relevan dengan metrik numerik.
2. Sertakan judul dokumen berbobot di baris pertama (# Judul Dokumen).
3. Berikan pengantar singkat sebelum tabel dan ringkasan eksekutif serta analisis mendalam (1-2 paragraf) setelah tabel yang membedah wawasan, tren, dan faktor penggerak dari data tersebut.`;
      } else if (isDocsArticleTask) {
        const paragraphMatch = userPrompt.match(/(?:tulis|buatkan|buat|ketik|isi)\s+(\d+)\s+paragraf/i);
        const paragraphCount = paragraphMatch ? parseInt(paragraphMatch[1], 10) : null;

        promptPayload = `Bertindaklah sebagai MASTER JOURNALIST & PRINCIPAL ESSAYIST KELAS DUNIA (Standar Publikasi Dokumen Resmi Google Docs).

[PERINTAH & TOPIK]:
${userPrompt}

[REFERENSI DARI WEB / TAB TERLAMPIR]:
Judul: ${pageTitle} | URL: ${pageUrl}
${cleanText.substring(0, 4500) || "(Gunakan instruksi pengguna sebagai referensi)"}

PEDOMAN KETAT PENULISAN DOKUMEN GOOGLE DOCS:
1. TULISKAN KONTEN / ARTIKEL LENGKAP UTUH yang langsung siap dipublikasikan ke lembar kerja Google Docs.
2. DILARANG KERAS memberikan instruksi manual atau panduan (seperti "Buka Google Docs...", "Langkah 1:...", dll.). LANGSUNG TULISKAN KONTEN ARTIKEL/BERITANYA DARI DATA REFERENSI!
3. Format dokumen:
   - Judul Dokumen yang Otoritatif di baris pertama (# Judul Berita / Artikel)
   - Lead / Paragraf pengantar
   - Rincian butir-butir utama (contoh: ## 1. Judul Berita, dengan 2-3 paragraf ulasan tajam dan fakta pendukung dari data web referensi)
   - Analisis implikasi dan kesimpulan
4. Gaya bahasa: Tajam, bernas, berwawasan mendalam, dan bebas klise robotik AI.${paragraphCount ? `\n5. Pengguna meminta tepat ${paragraphCount} paragraf: Patuhi secara presisi!` : ""}`;
      } else if (isSpreadsheetTask) {
	        promptPayload = `Bertindaklah sebagai MASTER SPREADSHEET & FINANCIAL DATA SCIENTIST EXPERT (Standar Senior Modeler & Excel Specialist).

	[PERINTAH & KEBUTUHAN DATA SPREADSHEET]:
	${userPrompt}

	[KONTEKS WEB SAAT INI (jika ada)]:
	Judul: ${pageTitle} | URL: ${pageUrl}
	${cleanText.substring(0, 4000)}

	PEDOMAN KETAT OUTPUT SPREADSHEET:
	1. SAJIKAN TABEL DATA LENGKAP DALAM FORMAT MARKDOWN TABLE (WAJIB):
	   - Kolom-kolom harus rapi, terisi penuh, dan presisi sesuai yang diminta pengguna.
	   - Tuliskan data riil, akurat, dan bersih tanpa placeholder [...].
	   - DILARANG membubuhkan tanda khusus Markdown seperti bintang ganda (**), asterisk (*), atau backtick di dalam sel tabel data (tulis langsung teks atau nilainya secara bersih, contoh: tulis 'Total' bukan '**Total**').
	   - Jika terdapat kolom harga atau nilai numerik, sertakan baris FORMULA / TOTAL / AVERAGE di baris paling bawah jika relevan (misal: | | Rata-rata Harga | | | =AVERAGE(E2:E4) |).
	2. Pastikan tabel Markdown menggunakan format standar (| baris | baris |) yang mudah di-parse dan di-paste langsung ke Google Sheets atau Excel.
	3. Sertakan 1 paragraf ringkasan singkat analisis di bawah tabel.`;
      } else if (isProductResearch) {
        promptPayload = `Lakukan RISET DAN ANALISIS KOMPARASI PRODUK MENDALAM & PROFESIONAL berdasarkan data katalog produk berikut:

[DATA KATALOG & WEB SAAT INI]:
Judul Halaman: ${pageTitle}
URL Halaman: ${pageUrl}

${cleanText.substring(0, 7500) || "(Gunakan instruksi pengguna di bawah sebagai referensi)"}

[INSTRUKSI RISET PENGGUNA]:
${userPrompt}

FORMAT LAPORAN RISET PRODUK:
# 📊 Laporan Riset & Rekomendasi Produk: [Nama Kategori / Kueri Produk]

> **Executive Summary**: (Uraikan tren harga rata-rata, rentang spesifikasi utama, dan kriteria terbaik untuk memilih produk ini)

### 🏆 Tabel Komparasi Produk Terpilih (Lengkap & Terstruktur):
| No | Nama Produk & Seri | Rentang Harga | Rating & Penjualan | Spesifikasi Kunci | Keunggulan Utama |
|---|---|---|---|---|---|
(Sajikan 5 hingga 8 produk terbaik dari data katalog dengan detail lengkap dan terverifikasi)

### 💡 Analisis Mendalam & Rekomendasi Terbaik:
1. **Best Overall (Pilihan Terbaik Keseluruhan)**: (Nama produk + alasan spesifikasi & keandalan)
2. **Best Value for Money (Paling Sepadan dengan Harga)**: (Nama produk + alasan efisiensi harga)
3. **Best High-End / Performance**: (Nama produk untuk kebutuhan komputasi berat)

### ⚠️ Panduan Pembelian & Hal yang Perlu Diperhatikan:
- Poin penting 1
- Poin penting 2`;
      } else if (isSocialThread) {
        promptPayload = `Tuliskan POSTINGAN TWITTER / X & MEDIA SOSIAL PROFESIONAL (standar thought leadership / tech executive terkemuka):

Judul Halaman: ${pageTitle}
URL Halaman: ${pageUrl}

[KONTEKS & SUMBER REFERENSI]:
${cleanText.substring(0, 7000) || "(Gunakan instruksi pengguna di bawah sebagai referensi utama)"}

[INSTRUKSI KHUSUS PENGGUNA]:
${userPrompt}

PEDOMAN TULISAN THREAD EKSEKUTIF (KOMPAK & BERBOBOT TINGGI):
1. Gaya Bahasa: Tajam, berwawasan, mengalir alami, dan otoritatif (gaya penulisan thought leader seperti Naval Ravikant, Sam Altman, atau Paul Graham).
2. Batas Karakter: Setiap butir tweet WAJIB ringkas (<200 karakter per butir) agar muat sempurna dalam 1 status Twitter/X tanpa terpotong.
3. Hashtag: Maksimal 1 hashtag esensial saja di akhir (misal: #Productivity). DILARANG menumpuk banyak hashtag!

FORMAT STRUKTUR OUTPUT:
### 🧵 THREAD TWITTER / X (Executive & High-Impact):

**Tweet 1:**
(Hook pembuka yang tajam dan menggugah wawasan + 🧵👇)

**Tweet 2:**
(Analisis inti masalah atau transformasi paradigma)

**Tweet 3:**
(Poin kunci dan bukti konkret manfaat)

**Tweet 4:**
(Kalimat penutup reflektif + ajakan diskusi + 1 hashtag relevan)

	---
	### 💼 FORMAT LINKEDIN (Long-form Post):
	(Format Hook Otoritatif $\\to$ Konteks Strategis $\\to$ 3 Key Takeaways $\\to$ Pertanyaan Diskusi)`;
      } else if (isDocsArticleTask || (isArticle && isDocsTarget)) {
        if (isSocialCopywritingForDocs) {
          promptPayload = `Bertindaklah sebagai PRINCIPAL SOCIAL MEDIA COPYWRITER & CONTENT STRATEGIST kelas dunia (spesialisasi: kurasi berita viral, hook retention tinggi, dan copywriting editorial multi-format untuk Instagram, X/Twitter, dan LinkedIn).

[PERINTAH KHUSUS PENGGUNA]:
${userPrompt}

[SUMBER REFERENSI DARI WEB / TAB AKTIF]:
Judul: ${pageTitle} | URL: ${pageUrl}
${cleanText.substring(0, 5000) || "(Gunakan data berita terhangat/terpopuler hari ini sebagai referensi)"}

PEDOMAN FORMAT DOKUMEN GOOGLE DOCS (SUPER RAPI & COPYWRITING EXPERT STANDAR INTERNASIONAL):
1. DILARANG membuat teks mentah tanpa struktur atau instruksi panduan (seperti "Buka Google Docs..."). LANGSUNG TULISKAN SELURUH DRAF KONTEN SIAP PAKAI!
2. FORMAT DOKUMEN HARUS SANGAT RAPI DENGAN HIERARKI JUDUL GOOGLE DOCS:
   # 📰 CURATED NEWS DIGEST & SOCIAL MEDIA COPYWRITING PACKAGE
   *(Kurasi Berita Terhangat Hari Ini & Paket Konten Siap Posting)*

   ---
   ## 🎯 Executive Summary & Hook Pembuka
   (Sajikan 2 paragraf pengantar bertenaga yang memikat pembaca, menguraikan isu terhangat hari ini dan implikasinya).

   ---
   ## 📑 Kurasi Berita Terhangat Hari Ini (Format News Digest)
   Sajikan berita-berita pilihan dengan format seragam:
   ### 1. [Headline Berita Menarik & Tajam]
   - 📌 **Fakta Utama**: Ringkasan padat 2-3 kalimat mengenai inti peristiwa.
   - 💡 **Key Takeaway / Dampak**: Mengapa berita ini penting bagi publik/bisnis.
   - 💬 **Sudut Pandang Copywriter**: Angle unik untuk memancing interaksi dan komentar audiens.

   ---
   ## 📱 Paket Draf Konten Siap Posting Media Sosial

   ### 🧵 Opsi A: Twitter / X Thread (High Retention)
   - **Tweet 1 (Hook)**: Kalimat pembuka menggugah/curiosity gap + 🧵👇
   - **Tweet 2**: Inti berita utama
   - **Tweet 3**: Fakta kunci & data menarik
   - **Tweet 4**: Analisis implikasi
   - **Tweet 5 (Closing & CTA)**: Ajakan berdiskusi di kolom komentar + 1 hashtag relevan

   ### 📸 Opsi B: Instagram / LinkedIn Carousel (Slide-by-Slide Outline)
   - **Slide 1**: Cover Hook yang menonjol
   - **Slide 2-6**: 1 Berita per Slide (Headline + 2 Poin Fakta)
   - **Slide 7**: Rangkuman & Save/Share Call-to-Action

   ### 📝 Opsi C: Caption Ringkas & Hashtag
   (Caption profesional, energik, rapi, lengkap dengan emoji terarah dan 3-5 hashtag tertarget).

3. GAYA BAHASA: Menggunakan prinsip copywriting modern AIDA (Attention, Interest, Desire, Action), diksi mengalir alami, tajam, bernas, dan bebas klise robotik AI.
4. ATURAN PENULISAN: DILARANG KERAS MENGGUNAKAN SIMBOL BLOCKQUOTE (>) ATAU (>>) DI AWAL BARIS! Format dokumen Google Docs harus bersih tanpa karakter '>'. Tuliskan langsung sebagai teks biasa, subjudul (# / ## / ###), atau poin (• / -).`;
        } else {
          const paragraphMatch = userPrompt.match(/(?:tulis|buatkan|buat|ketik|isi)\s+(\d+)\s+paragraf/i);
          const paragraphCount = paragraphMatch ? parseInt(paragraphMatch[1], 10) : null;

          promptPayload = `Bertindaklah sebagai JURNALIS PROFESIONAL & EDITOR KONTEN DOKUMEN GOOGLE DOCS.

[PERINTAH & TOPIK DARI PENGGUNA]:
${userPrompt}

[REFERENSI SUMBER DARI WEB / TAB TERLAMPIR]:
Judul: ${pageTitle} | URL: ${pageUrl}
${cleanText.substring(0, 4500) || "(Gunakan instruksi pengguna sebagai referensi)"}

PEDOMAN KETAT PENULISAN DOKUMEN GOOGLE DOCS:
1. TULISKAN KONTEN SESUAI PERMINTAAN SECARA MENDALAM, MENARIK, DAN FAKTUAL (Jika diminta 5 berita terviral, sajikan 5 berita terpopuler/terviral secara lengkap dengan ulasan faktual dan gaya bahasa jurnalistik menarik!).
2. DILARANG KERAS memberikan instruksi manual atau panduan (seperti "Buka Google Docs...", "Langkah 1:...", dll.). LANGSUNG TULISKAN KONTEN ARTIKEL/BERITANYA DARI DATA REFERENSI!
3. DILARANG membuat format briefing militer/intelijen kecuali pengguna secara eksplisit memintanya.
4. JANGAN menyertakan tabel Markdown jika pengguna tidak meminta tabel.
5. Format dokumen yang rapi:
   - Judul Dokumen di baris pertama (# Judul)
   - Lead / Paragraf pengantar
   - Rincian 5 berita / butir pembahasan utama (## 1. Judul Berita, ## 2. Judul Berita, dst. dengan paragraf ulasan padat)
   - Kesimpulan atau penutup yang relevan
6. Gaya bahasa: Mengalir alami, tajam, bernas, dan bebas klise robotik AI.
7. DILARANG KERAS MENGGUNAKAN SIMBOL BLOCKQUOTE (>) DI AWAL BARIS! Tuliskan seluruh teks dan butir secara langsung tanpa karakter '>'.${paragraphCount ? `\n8. Pengguna meminta tepat ${paragraphCount} paragraf: Patuhi secara presisi!` : ""}`;
        }
      } else if (isArticle) {
        const paragraphMatch = userPrompt.match(/(?:tulis|buatkan|buat|ketik|isi)\s+(\d+)\s+paragraf/i);
        const paragraphCount = paragraphMatch ? parseInt(paragraphMatch[1], 10) : null;

        promptPayload = `Bertindaklah sebagai MASTER TYPEWRITER & PRINCIPAL ESSAYIST KELAS DUNIA (standar editorial The Economist, Wall Street Journal, dan Paul Graham Essays).

[PERINTAH & TOPIK PENGGUNA]:
${userPrompt}

[REFERENSI HALAMAN (jika ada)]:
Judul: ${pageTitle} | URL: ${pageUrl}
${cleanText.substring(0, 3000)}

PEDOMAN KETAT TYPEWRITER EXPERT:
1. GAYA BAHASA & KEDALAMAN (Zero AI Cliché):
   - Gunakan gaya penulisan tajam, berwawasan mendalam, elegan, dan mengalir alami tanpa basa-basi.
   - DILARANG menggunakan pembuka klise seperti: "Dalam era digital saat ini...", "Seperti yang kita ketahui...", "Kecerdasan buatan telah mengubah...", "Di dunia modern ini...".
   - DILARANG menggunakan kata penghubung kaku: "Selain itu,", "Perlu diingat bahwa,", "Oleh karena itu kita harus,", "Tidak dapat dipungkiri bahwa,".
   - DILARANG menggunakan penutup klise: "Kesimpulannya,", "Sebagai penutup,", "Mari kita bersama-sama...".
   - Langsung masuk ke inti argumen, wawasan strategis, dan implikasi nyata dengan diksi berbobot tinggi.

2. KEPATUHAN FORMAT:${paragraphCount ? `\n   - PENGGUNA MEMINTA TEPAT ${paragraphCount} PARAGRAF: Tuliskan TEPAT ${paragraphCount} paragraf yang kaya substansi, padat, dan mengalir mulus tanpa sub-heading atau bullet points tambahan!` : `\n   - Buat judul berbobot di baris pertama (# Judul)\n   - Tuliskan paragraf-paragraf yang utuh, padat, dan terstruktur rapi.`}
3. DILARANG menggunakan tanda kurung siku placeholder ([...]), template kosong, atau format medsos (tweet/hashtag). Sajikan hasil final yang sempurna dan siap terbit.`;
      } else if (isSeo) {
        promptPayload = `Lakukan audit SEO profesional dan mendalam untuk halaman web berikut:

Judul Halaman: ${pageTitle}
URL Halaman: ${pageUrl}

[KONTEN & STRUKTUR HALAMAN]:
${cleanText.substring(0, 7000)}

Format laporan dalam Markdown yang rapi:
1. ### 🔍 Ringkasan & Skor SEO Halaman
2. ### 🏷️ Evaluasi Judul & Meta Tag
3. ### 📑 Analisis Struktur Konten & Heading (H1/H2/H3)
4. ### 🔑 Kerapatan & Distribusi Kata Kunci
5. ### 💡 Rekomendasi Optimasi Konkret (Actionable Fixes)`;
      } else if (isSecurity) {
        promptPayload = `Lakukan audit keamanan dan integritas web untuk halaman berikut:

Judul Halaman: ${pageTitle}
URL Halaman: ${pageUrl}

[KONTEN & STRUKTUR HALAMAN]:
${cleanText.substring(0, 7000)}

Format laporan dalam Markdown:
1. ### 🛡️ Status Protokol & Transport Security
2. ### ⚠️ Temuan Potensi Kerentanan & Resiko
3. ### 🔒 Rekomendasi Pengamanan Web`;
      } else if (isSummarize) {
        if (isSheetsSite) {
          promptPayload = `Tolong buat ringkasan eksekutif dan wawasan dari lembar kerja Google Spreadsheet / Excel berikut:

Judul Dokumen: ${pageTitle}
URL: ${pageUrl}

[KONTEN & DATA LEMBAR KERJA]:
${cleanText.substring(0, 7000) || "(Lembar kerja saat ini masih berupa spreadsheet kosong / belum memuat data sel)"}

INSTRUKSI PERANGKUMAN SPREADSHEET:
1. Jika lembar kerja berstatus kosong atau belum ada data entri, jelaskan secara ramah bahwa lembar kerja ini masih kosong dan berikan saran ringkas aksi yang dapat dilakukan (misal: meminta AI membuatkan tabel komparasi atau data penjualan).
2. Jika lembar kerja memiliki data/tabel/angka, sajikan analisis poin-poin kunci:
   - ### 📊 Ringkasan Dataset & Struktur Lembar Kerja
   - ### 📌 Temuan Utama & Analisis Angka
   - ### 💡 Kesimpulan & Rekomendasi
3. DILARANG membuat artefak file spreadsheet atau format formula buatan jika dokumen kosong. Format dalam teks Markdown rapi.`;
        } else {
          promptPayload = `Tolong buat ringkasan komprehensif, rapi, dan mudah dipahami dari konten halaman web berikut:

Judul: ${pageTitle}
URL: ${pageUrl}

[ISI KONTEN HALAMAN]:
${cleanText.substring(0, 7000)}

Format ringkasan dalam Markdown yang elegan:
### 📄 Ringkasan Eksekutif
(Satu paragraf ringkasan esensi utama)

### 📌 Poin-Poin Kunci
- (Gunakan bullet points berbobot dengan teks tebal pada topik penting)

### 💡 Kesimpulan & Tindak Lanjut
(Penjelasan akhir yang aplikatif)`;
        }
      } else {
        // Tanya Jawab / Pertanyaan Informasi umum / Analisis Dokumen
        const fileHeading = attachedFiles.length > 0
          ? `[DOKUMEN & FILE TERLAMPIR DARI PENGGUNA]:\n${fileContextBlock}\n\n`
          : "";

        promptPayload = `Anda adalah asisten AI pintar berkemampuan analisis dokumen mendalam. Jawablah instruksi pengguna berikut dengan komprehensif, tepat, dan jelas berdasarkan data terlampir atau halaman web.

${fileHeading}[KONTEKS HALAMAN WEB SAAT INI]
Judul Halaman: ${pageTitle}
URL Halaman: ${pageUrl}

[KONTEN DOKUMEN / REFERENSI]:
${cleanText.substring(0, 7500) || "(Tidak ada teks referensi tambahan; jawablah berdasarkan instruksi pengguna)"}

[INSTRUKSI / PERTANYAAN PENGGUNA]:
${userPrompt}

Instruksi:
Jawablah pertanyaan/instruksi pengguna secara langsung, jelas, dan ramah menggunakan bahasa Indonesia yang baik dalam format Markdown yang rapi.`;
      }

      showStatusIndicator("Menghasilkan respon instan...");

      let streamBubble = null;
      let streamContainer = null;
      const onChunk = (delta, accumulated) => {
        if (!streamBubble) {
          const chatAreaEl = document.getElementById("chatArea");
          if (chatAreaEl) {
            streamContainer = document.createElement("div");
            streamContainer.className = "message-row assistant streaming-bubble";
            streamBubble = document.createElement("div");
            streamBubble.className = "message-bubble markdown-body";
            streamContainer.appendChild(streamBubble);
            chatAreaEl.appendChild(streamContainer);
          }
        }
        if (streamBubble) {
          streamBubble.innerHTML = parseIncrementalMarkdown(accumulated);
          const chatAreaEl = document.getElementById("chatArea");
          if (chatAreaEl) chatAreaEl.scrollTop = chatAreaEl.scrollHeight;
        }
      };

      let aiReply;
      try {
        aiReply = await callLLM("chat", promptPayload, { isSummarize: isSummarize, onChunk });
      } finally {
        if (streamContainer && streamContainer.parentNode) {
          streamContainer.parentNode.removeChild(streamContainer);
        }
      }

      const isDocsOutput = isDocsTableTask || isDocsArticleTask || (isDocsTarget && (isArticle || isDocsTableTask));
      const artType = (isSpreadsheetTask || isGeneralTableTask || isProductResearch) ? "table" : (isSocialThread ? "social" : ((isArticle || isDocsOutput) ? "doc" : "text"));
      const artTitle = (isSpreadsheetTask || isGeneralTableTask || isProductResearch)
        ? `Tabel-${(userPrompt || "Data").slice(0, 24).replace(/[^a-zA-Z0-9]/g, "_")}.csv`
        : (isSocialThread
            ? `Thread-${(userPrompt || "Sosmed").slice(0, 24).replace(/[^a-zA-Z0-9]/g, "_")}.txt`
            : `Draf-${(userPrompt || "Dokumen").slice(0, 24).replace(/[^a-zA-Z0-9]/g, "_")}.doc`);

      const artifact = (!isSummarize && (isSpreadsheetTask || isGeneralTableTask || isProductResearch || isSocialThread || isArticle || isDocsOutput)) ? {
        artifactType: artType,
        name: artTitle,
        content: aiReply
      } : null;

      const isDocsOrEditor = (pageUrl.includes("docs.google.com") && !pageUrl.includes("/spreadsheets")) ||
                             pageUrl.includes("word.office.com") ||
                             pageTitle.includes("Google Dokumen") ||
                             pageTitle.includes("Google Docs") ||
                             /(?:lembar kerja|dokumen ini|ke dokumen|tulis ke|tempel ke|di dokumen)/i.test(userPrompt);

      const isSocialSite = pageUrl.includes("x.com") ||
                           pageUrl.includes("twitter.com") ||
                           pageUrl.includes("linkedin.com") ||
                           pageUrl.includes("facebook.com") ||
                           pageUrl.includes("threads.net");

      if (isDocsOutput) {
        if (!isDocsSite) {
          appendLog("Membuka lembar kerja Google Docs baru (docs.new)...");
          showStatusIndicator("Membuka lembar kerja Google Docs...");
          await sendToBackground({ action: "NAVIGATE_TAB", url: "https://docs.new" });

          let docsReady = false;
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 1000));
            try {
              const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
              if (tabs && tabs[0]?.url && tabs[0].url.includes("docs.google.com/document")) {
                docsReady = true;
                appendLog(`✓ Google Docs dimuat: ${tabs[0].title || "Dokumen"}`);
                break;
              }
            } catch (_) {}
          }

          if (!docsReady) {
            throw new Error("Google Docs tidak dapat dimuat dalam 20 detik. Periksa koneksi internet Anda.");
          }

          await new Promise(r => setTimeout(r, 2000));
        }

        showStatusIndicator("Menuliskan dokumen langsung ke Google Docs...");
        appendLog("📄 Menuliskan dokumen ke Google Docs...");
        await sendToContentScript({
          type: "EXECUTE_ACTION",
          actionData: {
            action: "paste_text",
            value: aiReply
          }
        }, 25000, 3);

        addMessageToCurrentSession("assistant", `### 📝 Dokumen Berhasil Dibuat & Dituliskan ke Google Docs\n\n${aiReply}`, {
          skipClean: true,
          artifact
        });
      } else if (isSpreadsheetTask && !isSummarize) {
        if (!isSheetsSite) {
          appendLog("Membuka lembar kerja Google Sheets baru (sheets.new)...");
          showStatusIndicator("Membuka lembar kerja Google Sheets...");
          await sendToBackground({ action: "NAVIGATE_TAB", url: "https://sheets.new" });

          // Polling hingga tab aktif ter-redirect ke docs.google.com/spreadsheets (maksimal 20 detik)
          let sheetsReady = false;
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 1000));
            try {
              const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
              if (tabs && tabs[0]?.url && tabs[0].url.includes("docs.google.com/spreadsheets")) {
                sheetsReady = true;
                appendLog(`✓ Google Sheets dimuat: ${tabs[0].title || "Spreadsheet"}`);
                break;
              }
            } catch (_) {}
          }

          if (!sheetsReady) {
            throw new Error("Google Sheets tidak dapat dimuat dalam 20 detik. Periksa koneksi internet Anda.");
          }

          await new Promise(r => setTimeout(r, 3500));
        }

        showStatusIndicator("Mengisikan data tabel langsung ke Google Sheets...");
        appendLog("📊 Mengisikan baris & kolom data langsung ke Google Sheets...");

        const tableData = typeof parseMarkdownTable === "function" ? parseMarkdownTable(aiReply) : null;

        const fillResult = await sendToContentScript({
          type: "EXECUTE_ACTION",
          actionData: {
            action: "fill_spreadsheet_grid",
            value: aiReply,
            tableData: tableData
          }
        }, 25000, 3);

        if (!fillResult.success) {
          appendLog(`⚠️ Peringatan pengisian sel: ${fillResult.error || "Gagal mengisi sel otomatis"}`, "WARN");
        }

        addMessageToCurrentSession("assistant", `### 📊 Data Berhasil Dibuat & Diisikan ke Google Sheets\n\n${aiReply}`, {
          skipClean: true,
          artifact
        });
      } else if (isDocsOrEditor && !isSocialThread && !isProductResearch && !isSpreadsheetTask && !isSummarize && (isArticle || /(?:tulis|buatkan|ketik|tempel|masukkan|isi|paragraf|artikel)/i.test(userPrompt))) {
        showStatusIndicator("Menuliskan teks langsung ke Google Dokumen / editor...");
        appendLog("📄 Menuliskan teks langsung ke Google Dokumen / Lembar kerja aktif...");
        await sendToContentScript({
          type: "EXECUTE_ACTION",
          actionData: {
            action: "paste_text",
            value: aiReply
          }
        });
        addMessageToCurrentSession("assistant", `### 📝 Teks Berhasil Dibuat & Dituliskan ke Dokumen\n\n${aiReply}`, {
          skipClean: true,
          artifact
        });
      } else if (isSocialSite && isSocialThread && !isSummarize) {
        showStatusIndicator("Menempelkan thread ke postingan media sosial...");
        appendLog("📱 Menempelkan teks thread ke postingan media sosial aktif...");
        await sendToContentScript({
          type: "EXECUTE_ACTION",
          actionData: {
            action: "paste_text",
            value: aiReply
          }
        });
        addMessageToCurrentSession("assistant", `### 📱 Thread Media Sosial Berhasil Dibuat\n\n${aiReply}`, {
          skipClean: true,
          artifact
        });
      } else {
        const headerTitle = isSocialThread
          ? "### 📱 Thread Media Sosial Berhasil Dibuat"
          : (isProductResearch
              ? "### 📊 Laporan Riset Produk & Tabel Data (.CSV)"
              : (isArticle
                  ? "### 📝 Artikel Berhasil Dibuat"
                  : (isSummarize
                      ? (isSheetsSite ? "### 📊 Ringkasan Lembar Kerja Spreadsheet" : "### 📄 Ringkasan Halaman Web")
                      : "")));
        const formattedReply = headerTitle ? `${headerTitle}\n\n${aiReply}` : aiReply;
        addMessageToCurrentSession("assistant", formattedReply, { skipClean: true, artifact });
      }
      appendLog("✅ Jawaban berhasil disajikan.");
    } catch (err) {
      if (err.name === "AbortError" || shouldStopAgent) {
        appendLog("🛑 Analisis dibatalkan.");
      } else {
        appendLog(`Error: ${err.message}`, "ERROR");
        addMessageToCurrentSession("assistant", `❌ Terjadi kesalahan: ${err.message}`);
      }
    } finally {
      setAgentRunning(false);
      hideStatusIndicator();
    }
  }

  async function startTask(goal, contextSources = []) {
    setAgentRunning(true);
    showStatusIndicator();
    appendLog(`Memulai task: "${goal}" (${contextSources.length} konteks terlampir)`);

    activeTask = newTask(goal, contextSources);
    taskCardMsgIndex = -1;
    await persistTask();

    try {
      // 1. Ambil konten teks dari seluruh tab referensi di latar belakang (tanpa gonta-ganti tab fisik)
      for (const src of (contextSources || [])) {
        if (src.type === "BrowserTab" && src.metadata?.tabId) {
          try {
            const tabRes = await new Promise((resolve) => {
              chrome.tabs.sendMessage(src.metadata.tabId, { type: "GET_READABLE_TEXT" }, (response) => {
                if (chrome.runtime.lastError) resolve(null);
                else resolve(response);
              });
            });
            if (tabRes && tabRes.text && tabRes.text.length > 20) {
              src.content = tabRes.text;
              src.metadata.extractedText = tabRes.text.slice(0, 4500);
              appendLog(`📖 Referensi "${src.name}" berhasil diekstrak di latar belakang (${src.metadata.extractedText.length} karakter).`);
            }
          } catch (e) {}
        }
      }

      // 2. Cek tab aktif saat ini & tentukan apakah perlu switch tab
      const isSocialPostingGoal = /(?:posting|post|tweet|unggah|publikasikan)\s+(?:ke\s+)?(?:x(?:\.com)?|twitter|threads(?:\.net|\.com)?|linkedin|medsos|media sosial)/i.test(goal) ||
                                  /(?:coba\s+)?posting\s+(?:tweet|utas|thread)/i.test(goal) ||
                                  /(?:posting|post)\s+(?:langsung\s+)?(?:di|ke)\s+(?:threads|x|twitter|linkedin)/i.test(goal);

      const isCopywritingTask = !isSocialPostingGoal && (
        /(copywriting|buatkan\s+(tulisan|artikel|konten|copy|penawaran|paragraf)|tulis\s+(copywriting|artikel|surat|penawaran|email|paragraf)|draft\s+|buat\s+(artikel|surat|email|copy|paragraf))/i.test(goal) ||
        /(?:tulis|ketik|buat|isi)\s+(?:\d+\s+)?paragraf/i.test(goal) ||
        /(?:tabel|table|data penjualan)/i.test(goal)
      );
      let activeTabInfo = null;
      try {
        const at = await chrome.tabs.query({ active: true, currentWindow: true });
        if (at && at[0]) activeTabInfo = at[0];
      } catch (e) {}

      const isEditorTab = (t) => t && (
        /docs\.google\.com/i.test(t.url || "") ||
        /word\.office\.com/i.test(t.url || "") ||
        /notion\.so/i.test(t.url || "") ||
        /medium\.com\/new-story/i.test(t.url || "") ||
        /editor|dokumen/i.test(t.title || "")
      );

      const targetEditorSource = (contextSources || []).find(s => s.type === "BrowserTab" && isEditorTab(s.metadata));
      const targetOtherSource = (contextSources || []).find(s => s.type === "BrowserTab" && s.metadata?.tabId);

      if (isCopywritingTask && isEditorTab(activeTabInfo)) {
        appendLog(`📝 Tab editor dokumen (${activeTabInfo.title}) aktif. Menyusun draf dan menulis langsung ke dokumen...`);
        showStatusIndicator("Menyusun teks & menulis ke Google Docs...");
        const aiText = await callLLM("chat", `Tolong tuliskan konten/teks berikut secara lengkap, mendalam, dan rapi sesuai instruksi:\n\n[PERINTAH]\n${goal}\n\n[KONTEKS DOKUMEN]\nJudul: ${activeTabInfo.title || ""}\nURL: ${activeTabInfo.url || ""}`);
        if (aiText) {
          await sendToContentScript({
            type: "EXECUTE_ACTION",
            actionData: {
              action: "paste_text",
              value: aiText
            }
          });
          const artifact = {
            artifactType: "doc",
            name: `Draf-${(goal || "Dokumen").slice(0, 24).replace(/[^a-zA-Z0-9]/g, "_")}.doc`,
            content: aiText
          };
          addMessageToCurrentSession("assistant", `### 📝 Teks Berhasil Dituliskan ke Dokumen\n\n${aiText}`, {
            skipClean: true,
            artifact
          });
          await finalizeTask("done", "✅ Teks berhasil dituliskan langsung ke lembar kerja dokumen.");
          return;
        }
      } else if (!isSocialPostingGoal && targetEditorSource && targetEditorSource.metadata?.tabId) {
        showStatusIndicator();
        appendLog(`🔄 Berpindah ke tab editor: ${targetEditorSource.name} (tabId: ${targetEditorSource.metadata.tabId})`);
        await sendToBackground({ action: "SWITCH_TAB", tabId: targetEditorSource.metadata.tabId });
        await new Promise(r => setTimeout(r, 600));
      } else if (!isCopywritingTask && !isSocialPostingGoal && targetOtherSource && targetOtherSource.metadata?.tabId) {
        showStatusIndicator();
        appendLog(`🔄 Berpindah otomatis ke tab target: ${targetOtherSource.name} (tabId: ${targetOtherSource.metadata.tabId})`);
        await sendToBackground({ action: "SWITCH_TAB", tabId: targetOtherSource.metadata.tabId });
        await new Promise(r => setTimeout(r, 600));
        sendToContentScript({
          type: "LOCK_PAGE",
          message: `Tab ${targetOtherSource.name} sedang dikontrol oleh Pesat AI Agent...`
        }).catch(() => {});
      }

      // ══ FAST PATH FOR POSTING DRAFT TO SOCIAL MEDIA (X / Twitter, Threads, LinkedIn) ══
      if (isSocialPostingGoal) {
        const targetPlatform = detectTargetSocialPlatform(goal, activeTabInfo?.url || "");
        appendLog(`📱 Mendeteksi instruksi posting ke ${targetPlatform.name}...`);
        showStatusIndicator(`Mempersiapkan materi postingan untuk ${targetPlatform.name}...`);

        let draftReferenceText = "";
        for (const s of (contextSources || [])) {
          const txt = s.content || s.metadata?.extractedText || "";
          if (txt && txt.length > 30) {
            draftReferenceText += `\n[SUMBER KONTEN DARI ${s.name || s.title}]:\n${txt}\n`;
          }
        }

        if (!draftReferenceText && activeTabInfo && !targetPlatform.domainCheck.test(activeTabInfo.url || "")) {
          try {
            const curRes = await sendToContentScript({ type: "GET_READABLE_TEXT" });
            if (curRes && curRes.text) draftReferenceText = curRes.text;
          } catch (_) {}
        }

        const tweetExtractorPrompt = `Tolong ekstrak atau susun teks postingan untuk platform ${targetPlatform.name} persis sesuai permintaan pengguna di bawah.

[PERINTAH PENGGUNA]:
${goal}

[REFERENSI DRAF DOKUMEN / KONTEN]:
${draftReferenceText || "(Gunakan instruksi pengguna langsung jika teks sudah tertera di perintah)"}

ATURAN KETAT:
1. Kembalikan HANYA teks postingan / tweet / thread yang diminta (misal jika diminta tweet 1 sampai 3, ekstrak poin-poin tersebut secara rapi).
2. DILARANG menambahkan kalimat pembuka atau penutup robotik (seperti "Tentu...", "Berikut drafnya:").
3. Hapus nomor label seperti "#### Tweet 1", "Tweet 1 (Hook Utama)", atau awalan quote '>', sajikan teks murni yang siap diposting langsung.
4. Berikan pemisah baris ganda yang rapi antar-paragraf atau antar-utas postingan.`;

        const extractedPostText = await callLLM("chat", tweetExtractorPrompt);
        if (extractedPostText && extractedPostText.trim().length > 5) {
          appendLog(`🚀 Membuka ${targetPlatform.name} dan mengisi postingan (${extractedPostText.trim().length} karakter)...`);
          showStatusIndicator(`Membuka ${targetPlatform.name} & mengisi postingan...`);

          const socialRes = await executeAgentAction({
            action: "post_social",
            platform: targetPlatform.platform,
            text: extractedPostText.trim(),
            sendNow: /(?:langsung posting|langsung post|langsung tweet|auto post|publish)/i.test(goal)
          });

          if (socialRes && socialRes.success) {
            addMessageToCurrentSession("assistant", `### 📱 Postingan ${targetPlatform.name} Berhasil Disiapkan\n\n${extractedPostText.trim()}`);
            await finalizeTask("done", `✅ Postingan berhasil disiapkan dan diisikan ke ${targetPlatform.name}.`);
            return;
          } else {
            throw new Error(socialRes?.error || `Gagal mengisi komposer ${targetPlatform.name}.`);
          }
        }
      }

			      // ══ FAST PATH FOR END-TO-END AUTOMATIONS (Spreadsheet, Email, & Social) ══
			      const isSpreadsheetGoal = /(?:spreadsheet|google sheets?|sheets\.new|ke dalam spreadsheet|ke spreadsheet|di spreadsheet|isi spreadsheet|tabel spreadsheet|buatkan tabel|buat tabel|tabel komparasi|tabel data|data penjualan)/i.test(goal);
			      if (isSpreadsheetGoal) {
			        appendLog("📊 Mengalihkan ke Spreadsheet Automation Engine...");
			        setAgentRunning(false);
			        if (activeTask) {
			          activeTask.status = "COMPLETED";
			          clearPersistedTask();
			          activeTask = null;
			        }
			        await runAnalysisFlow(goal, contextSources);
			        return;
			      }

	      // ══ FAST PATH FOR DIRECT NAVIGATION (Single clean step, no noisy ReAct loops) ══
	      const directNavRegex = /^(?:tolong\s+|mohon\s+)?(?:buka|kunjungi|open|go\s*to|akses)\s+(?:website\s+|web\s+|situs\s+|halaman\s+|url\s+)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?|https?:\/\/[^\s]+)\s*$/i;
	      const navMatch = goal.trim().match(directNavRegex);
	      if (navMatch) {
	        let dest = navMatch[1].trim();
	        if (!dest.startsWith("http://") && !dest.startsWith("https://")) {
	          dest = "https://" + dest;
	        }
		        showStatusIndicator(`Membuka ${dest}...`);
		        appendLog(`🌐 Membuka langsung situs: ${dest}`);
		        const navRes = await navigateToUrl(dest);
		        if (navRes && navRes.success !== false) {
		          await new Promise(r => setTimeout(r, 1200));
		          addMessageToCurrentSession("assistant", `✅ Berhasil membuka [${dest}](${dest})`);
		          await finalizeTask("done", `✅ Berhasil membuka ${dest}`);
		        } else {
		          addMessageToCurrentSession("assistant", `❌ Gagal membuka ${dest}: ${navRes?.error || "Gagal navigasi tab"}`);
		          await finalizeTask("error", `Gagal membuka ${dest}`);
		        }
		        return;
		      }

			      // ══ FAST PATH FOR FORM AUTO-FILL (Direct credential & field filling) ══
			      const hasEmailCred = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i.test(goal);
			      const isFormFillIntent = (
			        hasEmailCred &&
			        /(?:isi|masukkan|ketik|input|autofill|login|sign\s*in|masuk|daftar|akun|password|sandi)/i.test(goal)
			      ) || (
			        /(?:^(?:tolong\s+|mohon\s+)?(?:isi|masukkan|ketik|input|autofill)\b)/i.test(goal) &&
			        /(?:email|password|sandi|user|nama|telepon|alamat|login|akun)/i.test(goal)
			      );

			      if (isFormFillIntent) {
			        const emailMatch = goal.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
			        const extractedFields = [];
			        if (emailMatch) {
			          extractedFields.push({ identifier: "email", value: emailMatch[1] });
			        }

			        // Ekstraksi nilai password
			        const passMatch = goal.match(/(?:password|pass|sandi|kata sandi)\s*(?:login\s*ini)?\s*(?:dengan|adalah|:)?\s*([^\s,.]+)/i);
			        let passVal = passMatch ? passMatch[1].trim() : "";
			        if (!passVal || passVal.includes("@")) {
			          const tokens = goal.split(/\s+/).filter(t => t.length >= 3 && !t.includes("@") && !/^(?:isi|email|address|dan|password|login|ini|dengan|ke|di|tolong|mohon|setelah|itu|anda|lihat|menu)$/i.test(t));
			          if (tokens.length > 0) passVal = tokens[tokens.length - 1];
			        }
			        if (passVal) {
			          passVal = passVal.replace(/[.,;:]+$/, "");
			        }
			        if (passVal && !passVal.includes("@")) {
			          extractedFields.push({ identifier: "password", value: passVal });
			        }

			        if (extractedFields.length > 0) {
			          const shouldSubmit = /(?:login|masuk|sign\s*in|submit|kirim)/i.test(goal);
			          showStatusIndicator("Mengisi formulir login...");
			          appendLog(`📝 Mengisi ${extractedFields.length} field formulir secara otomatis${shouldSubmit ? " dan menekan Sign In..." : "..."}`);
			          const fillRes = await sendToContentScript({
			            type: "EXECUTE_ACTION",
			            actionData: {
			              action: "autofill_form_batch",
			              fields: extractedFields,
			              submitAfter: shouldSubmit
			            }
			          });

			          if (fillRes && fillRes.success && fillRes.filledCount > 0) {
			            const summaryStr = extractedFields.map(f => `${f.identifier}: ${f.value.includes("@") ? f.value : "••••••••"}`).join(", ");
			            addMessageToCurrentSession("assistant", `✅ Berhasil mengisi formulir (${fillRes.filledCount} field terisi: ${summaryStr})${shouldSubmit ? " dan menekan tombol Sign In." : "."}`);

			            const hasFollowUp = /(?:setelah itu|lalu|kemudian|selanjutnya)\s+(.+)/i.test(goal);
			            if (!hasFollowUp) {
			              await finalizeTask("done", `Berhasil mengisi formulir login.`);
			              return;
			            } else {
			              appendLog("⏳ Menunggu proses login selesai (1.8s) untuk memproses instruksi lanjutan...");
			              await new Promise(r => setTimeout(r, 1800));
			            }
			          }
			        }
			      }

		      // ══ PRE-EXECUTION GATE: THINK & PLAN DULU, KALAU RAGU INTERVIEW USER ══
		      const isSearchIntent = /^(?:tolong\s+|mohon\s+)?(?:cari|search|temukan|carikan)\s+(.+)/i.test(goal.trim());
		      const currentUrl = activeTabInfo?.url || "";
		      const isContentSiteActive = currentUrl && !/^(?:chrome|about|edge):/i.test(currentUrl) && !/google\.com|bing\.com|duckduckgo\.com/i.test(currentUrl);

		      if (isSearchIntent && isContentSiteActive) {
		        let hostName = "";
		        try {
		          hostName = new URL(currentUrl).hostname.replace(/^www\./i, "");
		        } catch (_) {}

		        const rawSearchQuery = goal.trim()
		          .replace(/^(?:tolong\s+|mohon\s+)?(?:cari|search|temukan|carikan)\s+/i, "")
		          .replace(/(?:dan\s+)?(?:kasih\s+tau|beritahu|tampilkan|bacakan).*$/i, "")
		          .trim();

		        if (hostName && rawSearchQuery && !/di google/i.test(goal)) {
		          appendLog(`🤔 Mendeteksi ambiguitas konteks pencarian antara ${hostName} vs Google Search. Mewawancarai pengguna...`);
		          const userChoice = await requestAskUser(
		            `Anda saat ini sedang membuka **${hostName}**.\nDi mana Anda ingin mencari berita/informasi tentang "**${rawSearchQuery}**"?`,
		            [`🔍 Cari di ${hostName}`, `🌐 Cari di Google Search`]
		          );

		          if (shouldStopAgent || !userChoice) {
		            await finalizeTask("cancelled", "⛔ Tugas dibatalkan.");
		            return;
		          }

		          if (userChoice.includes("Google Search")) {
		            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(rawSearchQuery)}`;
		            showStatusIndicator(`Mencari "${rawSearchQuery}" di Google...`);
		            await navigateToUrl(googleUrl);
		            await new Promise(r => setTimeout(r, 1200));
		            addMessageToCurrentSession("assistant", `🔍 Telah membuka pencarian Google untuk: **${rawSearchQuery}**`);
		            await finalizeTask("done", `Pencarian Google selesai.`);
		            return;
		          } else {
		            showStatusIndicator(`Mencari "${rawSearchQuery}" di ${hostName}...`);
		            appendLog(`🔎 Mencoba mencari "${rawSearchQuery}" di ${hostName}...`);
		            const siteSearchUrl = `https://${hostName}/search?q=${encodeURIComponent(rawSearchQuery)}`;
		            await navigateToUrl(siteSearchUrl);
		            await new Promise(r => setTimeout(r, 1500));
		            addMessageToCurrentSession("assistant", `🔍 Telah membuka hasil pencarian di **${hostName}** untuk: **${rawSearchQuery}**`);
		            await finalizeTask("done", `Pencarian di ${hostName} selesai.`);
		            return;
		          }
		        }
		      }

      const fastAction = tryParseNaturalLanguageActions("", goal);
      if (fastAction && (fastAction.action === "send_email" || fastAction.action === "post_social")) {
        const steps = fastAction.planner?.steps || [
          `1. Membuka formulir target`,
          `2. Memasukkan data dan teks pesan`,
          `3. Menyelesaikan pengisian formulir`
        ];
        activeTask.plan = steps.map((desc, idx) => ({
          id: idx + 1,
          description: desc,
          status: idx === 0 ? "in_progress" : "pending"
        }));
        activeTask.currentSubtask = 1;
        activeTask.status = "EXECUTING";
        refreshTaskCard();
        await persistTask();

        appendLog(`🚀 Mengeksekusi otomatisasi langsung: ${fastAction.message || fastAction.action}`);
        const execRes = await executeAgentAction(fastAction);
        if (execRes && execRes.success) {
          (activeTask.plan || []).forEach(s => s.status = "done");
          refreshTaskCard();
          await finalizeTask("done", execRes.message || "Tugas berhasil diselesaikan secara tuntas.");
          return;
        }
      }

      // ══ FASE PLAN ══
      const initialScan = await scanPage(true);
      const contextPrompt = typeof PesatContextEngine !== "undefined" && activeTask?.contextSources?.length
        ? "\n" + PesatContextEngine.formatStructuredContextPrompt(activeTask.contextSources)
        : "";
      const planPrompt = `
[KONDISI AWAL HALAMAN]
Judul: ${initialScan.title} | URL: ${initialScan.url} | Elemen: ${initialScan.elementsCount}
${contextPrompt}
${activeTask.confirmAllGranted ? "" : ""}
[INSTRUKSI PENGGUNA]
"${goal}"

Susun rencana subtask (maksimal 7) untuk mencapai goal di atas.
`.trim();

      let plan = null;
      try {
        const planReply = await callLLM("plan", planPrompt);
        const parsed = parseActionJSON(planReply);
        if (parsed && Array.isArray(parsed.plan) && parsed.plan.length > 0) {
          plan = parsed.plan
            .map((s, i) => ({
              id: s.id || (i + 1),
              description: String(s.description || s).substring(0, 200),
              status: "pending"
            }))
            .slice(0, 7);
        }
      } catch (err) {
        appendLog(`Planner error: ${err.message}`, "WARN");
      }

      if (!plan) {
        // Fallback: satu subtask = goal itu sendiri
        plan = [{ id: 1, description: goal.substring(0, 200), status: "pending" }];
      }

      activeTask.plan = plan;
      activeTask.status = "EXECUTING";
      const firstSub = currentSubtaskObj();
      activeTask.currentSubtask = firstSub ? firstSub.id : null;

      await persistTask();
      appendLog(`🗓️ Rencana disusun (${plan.length} subtask).`);
      await executeTaskLoop();
    } catch (err) {
      if (err.name === "AbortError" || shouldStopAgent) {
        appendLog("🛑 Task dibatalkan oleh pengguna.");
        if (activeTask) {
          activeTask.status = "CANCELLED";
          refreshTaskCard();
          await clearPersistedTask();
          activeTask = null;
        }
      } else {
        appendLog(`Error task: ${err.message}`, "ERROR");
        addMessageToCurrentSession("assistant", `❌ Terjadi kesalahan: ${err.message}`);
        if (activeTask) {
          activeTask.status = "FAILED";
          refreshTaskCard();
          await clearPersistedTask();
          activeTask = null;
        }
      }
    } finally {
      setAgentRunning(false);
      hideStatusIndicator();
      await sendToContentScript({ type: "CLEAR_MARKERS" }, 4000);
    }
  }

  async function executeTaskLoop() {
    if (!activeTask) return;
    let lastNavigationWasRecent = false;

    while (activeTask && activeTask.stepsUsed < activeTask.stepBudget && !shouldStopAgent) {
      activeTask.stepsUsed++;
      const stepNum = activeTask.stepsUsed;
      const sub = currentSubtaskObj();

      // Semua subtask selesai → validasi akhir → selesai
      if (!sub) {
        await finalizeTask("done", "Tugas selesai.");
        return;
      }

      activeTask.currentSubtask = sub.id;
      if (sub.status !== "in_progress") markSubtask(sub.id, "in_progress");
      refreshTaskCard();
      setAgentRunning(true);
      showStatusIndicator();

      // 1. Scan halaman (adaptif)
      const fullScan = stepNum === 1 || lastNavigationWasRecent;
      lastNavigationWasRecent = false;
      const pageData = await scanPage(fullScan);
      const tabsCtx = await getTabsContext();

      if (shouldStopAgent) break;

      // Fast path untuk Google Docs saat subtask meminta membuat / menyisipkan tabel
      const isDocsPage = pageData?.url?.includes("docs.google.com") && !pageData?.url?.includes("/spreadsheets");
      if (isDocsPage && /(?:tabel|table|sisipkan.*tabel|buat.*tabel|isi.*tabel)/i.test(sub.description || activeTask.goal)) {
        appendLog(`📄 Menyusun tabel terstruktur dan menuliskan langsung ke Google Docs...`);
        showStatusIndicator("Menuliskan tabel ke Google Docs...");
        const tablePrompt = `Tolong buatkan dokumen dengan tabel yang rapi, lengkap, dan berbobot sesuai permintaan berikut:\n\n[PERINTAH]\n${activeTask.goal}\n\nSubtask: ${sub.description}\n\nFormat tabel dalam Markdown table standar dengan header jelas dan baris data lengkap.`;
        const tableContent = await callLLM("chat", tablePrompt);
        if (tableContent) {
          await executeAgentAction({ action: "paste_text", value: tableContent });
          markSubtask(sub.id, "done");
          refreshTaskCard();
          await finalizeTask("done", "✅ Tabel dan dokumen data berhasil dibuat ke Google Docs.");
          return;
        }
      }

      // 2. Prompt Navigator
      const contextPrompt = typeof PesatContextEngine !== "undefined" && activeTask?.contextSources?.length
        ? "\n" + PesatContextEngine.formatStructuredContextPrompt(activeTask.contextSources)
        : "";
      const actPrompt = `
${buildPageContext(pageData, fullScan, stepNum)}${tabsCtx}${contextPrompt}

[SUBTASK AKTIF #${sub.id}]
${sub.description}

[PERINTAH]
Kembalikan SATU aksi JSON terbaik berikutnya untuk menyelesaikan subtask aktif menuju goal. Jika seluruh goal sudah tercapai, kembalikan finish.
`.trim();

      showStatusIndicator();
      appendLog(`─── Step ${stepNum} (subtask #${sub.id}) ───`);

      let reply;
      try {
        reply = await callLLM("act", actPrompt, { image: activeTask._pendingScreenshot || null });
      } catch (err) {
        if (err.name === "AbortError" || shouldStopAgent) break;
        appendLog(`Navigator error: ${err.message}`, "ERROR");
        addMessageToCurrentSession("assistant", `❌ Gagal menghubungi AI Engine: ${err.message}`);
        await finalizeTask("failed", `Gagal menghubungi AI Engine: ${err.message}`);
        return;
      }
      activeTask._pendingScreenshot = null;

      if (shouldStopAgent) break;

      let resObj = null;

      // 1. Cek Native Tool Calls (OpenAI standard format)
      if (reply && reply.tool_calls && Array.isArray(reply.tool_calls) && reply.tool_calls.length > 0) {
        const tc = reply.tool_calls[0];
        const fnName = tc.function?.name;
        let fnArgs = {};
        try {
          fnArgs = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function?.arguments || {});
        } catch (e) {
          fnArgs = {};
        }

        resObj = {
          action: fnName,
          ...fnArgs
        };

        if (fnName === "navigate_to") {
          resObj.action = "navigate";
          resObj.url = fnArgs.url;
          resObj.value = fnArgs.url;
        } else if (fnName === "click_element") {
          resObj.action = "click";
          resObj.elementId = fnArgs.elementId;
          resObj.targetText = fnArgs.targetText;
          resObj.selector = fnArgs.selector;
        } else if (fnName === "type_text") {
          resObj.action = "type";
          resObj.elementId = fnArgs.elementId;
          resObj.targetText = fnArgs.targetText;
          resObj.text = fnArgs.text;
          resObj.value = fnArgs.text;
          resObj.pressEnter = fnArgs.pressEnter;
        } else if (fnName === "press_key") {
          resObj.action = "press_key";
          resObj.key = fnArgs.key;
          resObj.elementId = fnArgs.elementId;
        } else if (fnName === "ask_user") {
          resObj.action = "ask_user";
          resObj.question = fnArgs.question;
          resObj.options = fnArgs.options;
        } else if (fnName === "finish_task") {
          resObj.action = "finish";
          resObj.message = fnArgs.message;
        }
      } else {
        resObj = parseActionJSON(reply);
        if (!resObj || (!resObj.action && !resObj.actions && !resObj.message && !resObj.question)) {
          resObj = tryParseNaturalLanguageActions(reply, activeTask.goal);
        }
      }

      // 2. Circuit Breaker & Anti-Looping (Dynamic ReAct Step Budget)
      activeTask.maxReActSteps = activeTask.maxReActSteps || 10;
      if (stepNum > activeTask.maxReActSteps) {
        if (stepNum <= 20) {
          const extendChoice = await requestAskUser(
            `Tugas telah berjalan ${stepNum - 1} langkah. Apakah Anda ingin mengizinkan 8 langkah lanjutan agar tugas selesai tuntas?`,
            ["Ya, Lanjutkan 8 Langkah Lagi", "Selesai Sekarang"]
          );
          if (extendChoice && extendChoice.includes("Lanjutkan")) {
            activeTask.maxReActSteps += 8;
            appendLog(`User mengizinkan penambahan langkah (Batas baru: ${activeTask.maxReActSteps} langkah). Melanjutkan...`);
          } else {
            appendLog("Pengguna memilih menyelesaikan tugas pada batas langkah tercapai.", "INFO");
            await finalizeTask("done", "✅ Tugas telah diproses hingga batas langkah yang disetujui pengguna.");
            return;
          }
        } else {
          appendLog("⚠️ Mencapai batas maksimum ReAct Loop keseluruhan. Mengakhiri tugas secara aman.", "WARN");
          await finalizeTask("done", "✅ Tugas telah diproses hingga batas maksimum yang aman.");
          return;
        }
      }

      if (resObj && resObj.action && resObj.action !== "ask_user" && resObj.action !== "finish") {
        const isTypingAction = resObj.action === "type" || resObj.action === "type_text" || resObj.action === "fill";
        const isClickAction = resObj.action === "click" || resObj.action === "click_element";
        const isSocialPage = /x\.com|twitter\.com|linkedin\.com|facebook\.com|threads\.net/i.test(pageData.url || "");
        const isGmailPage = /mail\.google\.com/i.test(pageData.url || "");

        // Anti-Loop Khusus Komposer Media Sosial / Editor: Cegah pengetikan berulang pada elemen textbox yang sama
        if (isTypingAction && isSocialPage) {
          if (activeTask._socialComposerFilled) {
            appendLog(`📱 Komposer media sosial sudah terisi. Menyelesaikan tugas draf postingan.`, "INFO");
            (activeTask.plan || []).forEach(p => { p.status = "done"; });
            refreshTaskCard();
            await persistTask();
            await finalizeTask("done", "✅ Draf postingan media sosial telah berhasil disusun dan diisikan ke komposer.");
            return;
          }
          activeTask._socialComposerFilled = true;
        }

        // Anti-Loop Universal: Cegah type_text yang identik ke elemen yang sama secara berulang
        if (isTypingAction) {
          const typeSig = `${resObj.elementId || resObj.targetText || ""}::${String(resObj.text || resObj.value || "").length}`;
          if (!activeTask._filledTextboxSigs) activeTask._filledTextboxSigs = new Set();
          if (activeTask._filledTextboxSigs.has(typeSig)) {
            appendLog(`✍️ Elemen textbox sudah pernah diisi dengan teks yang sama (Anti-Loop). Melanjutkan ke subtask berikutnya.`, "INFO");
            markSubtask(sub.id, "done");
            refreshTaskCard();
            await persistTask();
            continue;
          }
          activeTask._filledTextboxSigs.add(typeSig);
        }

        // Anti-Loop Khusus Gmail: Jika dialog 'Pesan Baru' / Compose sudah terbuka, cegah klik tombol Tulis berulang dan langsung isi form
        if (isGmailPage && isClickAction) {
          const isTargetingCompose = /tulis|compose/i.test(resObj.targetText || "") || resObj.elementId === "@e1";
          const isComposeDialogOpen = (pageData.reducedDOM || "").includes("Kepada") ||
                                      (pageData.reducedDOM || "").includes("Subjek") ||
                                      (pageData.reducedDOM || "").includes("Subject");

          if (isTargetingCompose && isComposeDialogOpen) {
            appendLog(`✉️ Formulir Compose Gmail sudah terbuka di layar. Mengarahkan agen langsung mengisi penerima, subjek, & pesan.`, "INFO");
            const goalText = activeTask.goal || "";
            const toM = goalText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
            const subM = goalText.match(/(?:subjek|subject|judul)\s*[:=]?\s*[`"']?([^`"'\n,]+?)(?=\s+(?:pesan|isi|body|dengan isi)|[`"']|$)/i);
            const bodyM = goalText.match(/(?:pesan|isi|body|draf email|tulis draf|tulis)\s*[:=]?\s*[`"']?([\s\S]+?)[`"']?$/i);

            resObj = {
              action: "send_email",
              to: toM ? toM[1] : "",
              subject: subM ? subM[1].trim() : "Pesan Baru",
              body: bodyM ? bodyM[1].trim() : goalText,
              sendNow: /(?:kirim sekarang|langsung kirim|auto send|kirimkan|kirim)/i.test(goalText)
            };
          }
        }

        const actionSig = `${resObj.action}:${resObj.elementId || resObj.targetText || resObj.url || resObj.key || ""}:${resObj.text || resObj.value || ""}`;
        if (activeTask.lastActionSig === actionSig) {
          activeTask.repeatActionCount = (activeTask.repeatActionCount || 0) + 1;
        } else {
          activeTask.lastActionSig = actionSig;
          activeTask.repeatActionCount = 1;
        }

        if (activeTask.repeatActionCount >= 3) {
          appendLog(`⚠️ Deteksi aksi berulang "${resObj.action}" 3x (Anti-Loop Circuit Breaker). Mencoba beralih ke subtask berikutnya...`, "WARN");
          markSubtask(sub.id, "done");
          refreshTaskCard();
          activeTask.repeatActionCount = 0;
          activeTask.lastActionSig = null;
          continue;
        }
      }

      // 3. Human-in-the-Loop (`ask_user`)
      if (resObj && (resObj.action === "ask_user" || resObj.isAskUser)) {
        const questionText = resObj.question || "Apakah Anda ingin melanjutkan tindakan ini?";
        const optionsList = Array.isArray(resObj.options) && resObj.options.length > 0 ? resObj.options : ["Ya, Lanjutkan", "Batalkan"];
        const userChoice = await requestAskUser(questionText, optionsList);
        if (shouldStopAgent || !userChoice || userChoice.toLowerCase().includes("batal")) {
          await finalizeTask("cancelled", "⛔ Tugas dibatalkan oleh pengguna.");
          return;
        }
        appendLog(`User memilih: "${userChoice}". Melanjutkan eksekusi...`);
        continue;
      }

      // Intent recovery: jika model merespon teks namun menyebut tab yang harus dibuka
      if (!resObj) {
        const tabSource = (activeTask.contextSources || []).find(
          s => s.type === "BrowserTab" && s.metadata?.tabId && (
            reply.toLowerCase().includes(s.name.toLowerCase()) ||
            sub.description.toLowerCase().includes(s.name.toLowerCase()) ||
            sub.description.includes(String(s.metadata.tabId))
          )
        );
        if (tabSource && tabSource.metadata?.tabId) {
          appendLog(`💡 Intent recovery: Mendeteksi aksi switch_tab ke ${tabSource.name} (tabId: ${tabSource.metadata.tabId})`);
          resObj = { action: "switch_tab", tabId: tabSource.metadata.tabId, matchTitle: tabSource.name };
        }
      }

      if (!resObj) {
        // 1. Cek apakah instruksi adalah tindakan nyata pengiriman email di browser
        const isEmailAction = /(?:kirim|tulis|buka|send)\s+(?:ke\s+)?email|gmail/i.test(activeTask.goal || sub.description || "");
        // 2. Cek apakah instruksi adalah tindakan nyata posting ke Twitter/X atau medsos di browser
        const isSocialAction = /(?:posting|post|tweet|thread|x\.com|twitter|medsos|linkedin)\b/i.test(activeTask.goal || sub.description || "");
        const isContentTask = !isEmailAction && !isSocialAction && /(copywriting|tulis artikel|buatkan draf artikel|surat penawaran)/i.test(activeTask.goal || sub.description);

        if (isEmailAction) {
          const emailParams = extractEmailParameters(activeTask.goal || sub.description || "");
          appendLog(`📧 Mengonversi draf ke aksi automasi email fisik ke ${emailParams.to || "penerima"}...`);
          resObj = {
            action: "send_email",
            to: emailParams.to,
            subject: emailParams.subject,
            body: emailParams.body || reply || activeTask.goal,
            sendNow: /(?:kirim sekarang|langsung kirim|auto send)/i.test(activeTask.goal)
          };
        } else if (isSocialAction) {
          appendLog(`📱 Mengonversi draf ke aksi postingan fisik di Twitter/X / Media Sosial...`);
          resObj = {
            action: "post_social",
            text: reply || activeTask.goal,
            sendNow: /(?:langsung posting|langsung tweet|auto post|publish)/i.test(activeTask.goal)
          };
        } else if (reply && (reply.length > 100 || isContentTask)) {
          const isTable = /\|.*\|[\r\n]+\|[-:\s|]+\|/i.test(reply) || /(?:riset|tabel|laptop|produk|komparasi|harga|spesifikasi|csv|penjualan)/i.test(activeTask.goal || sub.description);
          const artType = isTable ? "table" : "text";
          const artTitle = isTable
            ? `Tabel-${(activeTask.goal || "Data").slice(0, 24).replace(/[^a-zA-Z0-9]/g, "_")}.csv`
            : `Draf-${(activeTask.goal || "Copywriting").slice(0, 24).replace(/[^a-zA-Z0-9]/g, "_")}.doc`;

          appendLog(`✍️ Model berhasil menghasilkan ${isTable ? "tabel data riset/komparasi" : "draf tulisan"} (${reply.length} karakter).`);
          const artifact = {
            artifactType: artType,
            name: artTitle,
            content: reply
          };
          activeTask.artifacts.push(artifact);

          addMessageToCurrentSession("assistant", `${isTable ? "### 📊 Tabel Data Berhasil Dibuat (.CSV)" : "### 📝 Draf Copywriting Berhasil Dibuat"}\n\n${reply}`, {
            skipClean: true,
            artifact
          });

          // Cek jika halaman saat ini adalah Google Docs / editor, langsung tempelkan
          const isDocs = pageData.url?.includes("docs.google.com") && !pageData.url?.includes("/spreadsheets");
          const isSheets = pageData.url?.includes("/spreadsheets") || pageData.url?.includes("excel.office.com");

          if (isSheets && !activeTask._sheetWritten) {
            activeTask._sheetWritten = true;
            showStatusIndicator("Mengisikan data tabel ke Google Sheets...");
            await executeAgentAction({ action: "fill_spreadsheet_grid", value: reply });
          } else if (isDocs && !activeTask._articleWritten) {
            activeTask._articleWritten = true;
            showStatusIndicator("Menempelkan teks ke editor dokumen...");
            await executeAgentAction({ action: "paste_text", value: reply });
          }

          // Tandai seluruh plan sebagai done dan akhiri task — JANGAN continue (mencegah loop)
          (activeTask.plan || []).forEach(s => { s.status = "done"; });
          refreshTaskCard();
          await persistTask();
          await finalizeTask("done", "✅ Konten telah selesai dirumuskan dan disimpan di panel artefak.");
          return;
        }

        const remainingPlan = (activeTask.plan || []).filter(s => s.status !== "done");
        if (remainingPlan.length > 0 && stepNum <= 3) {
          appendLog(`⚠️ Navigator memberikan respon tekstual di Step ${stepNum}. Mencatat observasi dan meminta aksi lanjutan...`, "WARN");
          activeTask.scratchpad.push({
            step: stepNum,
            subtask: sub.id,
            observation: `Respon AI: "${reply.slice(0, 180)}..."`,
            action: "text_guidance",
            result: "info"
          });
          persistTask();

          // Cek apakah ada tab target yang belum dibuka
          const matchTab = (activeTask.contextSources || []).find(s => s.type === "BrowserTab" && s.metadata?.tabId);
          if (matchTab && matchTab.metadata?.tabId) {
            resObj = { action: "switch_tab", tabId: matchTab.metadata.tabId, matchTitle: matchTab.name };
          } else {
            continue;
          }
        } else {
          // Jawaban teks biasa di langkah akhir → tampilkan & akhiri
          addMessageToCurrentSession("assistant", reply);
          await finalizeTask("done", reply || "AI memberikan jawaban akhir.");
          return;
        }
      }

      // 3. Konfirmasi aksi berisiko (Phase 7.1)
      if (isRiskyAction(resObj) && !activeTask.confirmAllGranted) {
        const verdict = await requestConfirmation(resObj);
        if (shouldStopAgent || !verdict || verdict.cancelled) {
          await finalizeTask("cancelled", "⛔ Task dibatalkan: aksi berisiko tidak disetujui.");
          return;
        }
        if (!verdict.approved) {
          // Ditolak → catat & minta Navigator pilih aksi lain
          activeTask.scratchpad.push({
            step: stepNum, subtask: sub.id,
            observation: `Pengguna MENOLAK aksi ${resObj.action || "batch"}: ${resObj.message || ""}`,
            action: "user_denied", result: "failed"
          });
          persistTask();
          continue;
        }
        if (verdict.allowAll) {
          activeTask.confirmAllGranted = true;
        }
        if (activeTask.status === "WAITING_USER") {
          activeTask.status = "EXECUTING";
        }
      }

      // 4. Ask_user → pause
      if (resObj.action === "ask_user" || resObj.question) {
        const answer = await requestAskUser(
          resObj.question || resObj.message || "Silakan pilih tindakan:",
          resObj.options
        );
        if (shouldStopAgent || !answer) {
          await finalizeTask("cancelled", "Task dibatalkan saat menunggu jawaban pengguna.");
          return;
        }
        activeTask.clarifications.push(answer);
        activeTask.status = "EXECUTING";
        persistTask();
        continue;
      }

      // 5. Eksekusi aksi
      showStatusIndicator();
      const currentActionType = resObj?.action || resObj?.type || (Array.isArray(resObj?.actions) ? "batch" : "unknown");
      appendLog(`▶ [Step ${stepNum}] ${(Array.isArray(resObj.actions) ? `batch(${resObj.actions.length})` : currentActionType)} ${resObj.elementId ? `[${resObj.elementId}]` : ""} ${resObj.url ? resObj.url : ""}`);

      let exec;
      try {
        exec = await executeAgentAction(resObj);
      } catch (err) {
        exec = { success: false, actionType: currentActionType, message: err.message };
      }

      const execActionType = exec?.actionType || currentActionType;

      // 6. Catat scratchpad
      activeTask.scratchpad.push({
        step: stepNum,
        subtask: sub.id,
        observation: `${execActionType}: ${exec.message || (exec.success ? "OK" : "gagal")}`.substring(0, 300),
        action: execActionType,
        result: exec.success ? "success" : "failed"
      });
      await persistTask();

      // 7. Kartu Navigator + bukti visual
      let thumbDataUrl = null;
      if (exec.success && ["navigate", "click", "batch"].includes(execActionType) && visionEnabled) {
        thumbDataUrl = await captureScreenshot();
        if (thumbDataUrl) activeTask._pendingScreenshot = thumbDataUrl;
      }
      if (execActionType === "screenshot" && exec.screenshotDataUrl) {
        thumbDataUrl = exec.screenshotDataUrl;
        activeTask._pendingScreenshot = exec.screenshotDataUrl;
      }

      const agentCardPayload = {
        skipClean: true,
        multiAgent: {
          planner: resObj.planner ? resObj.planner : null,
          navigator: {
            action: execActionType,
            elementId: resObj.elementId || (Array.isArray(resObj.actions) ? resObj.actions.map(a => a.elementId).join(",") : ""),
            description: resObj.message || exec.message || `Mengeksekusi ${execActionType}`,
            status: exec.success ? "Selesai" : "Gagal",
            screenshot: thumbDataUrl
          },
          validator: null
        }
      };

      if (activeTask._multiAgentMsgIndex !== undefined && activeTask._multiAgentMsgIndex >= 0) {
        updateMessageInSession(activeTask._multiAgentMsgIndex, agentCardPayload);
      } else {
        const curSession = getCurrentSession();
        const curLen = curSession?.messages?.length || 0;
        activeTask._multiAgentMsgIndex = curLen;
        addMessageToCurrentSession("assistant", "", agentCardPayload);
      }

      if (execActionType === "navigate" && exec.success) {
        lastNavigationWasRecent = true;
      }

      // 8. Finish langsung
      if (exec.isFinished) {
        // Aksi end-to-end khusus seperti post_social atau send_email langsung menyelesaikan seluruh alur tugas
        const isEndToEndAction = ["post_social", "post_twitter", "post_x", "send_email", "compose_email"].includes(execActionType);
        if (isEndToEndAction) {
          (activeTask.plan || []).forEach(p => { p.status = "done"; });
          refreshTaskCard();
          await persistTask();
          await finalizeTask("done", exec.message);
          return;
        }

        // Cegah finish prematur untuk tugas umum jika masih banyak subtask yang belum dijalankan
        const pendingSubs = (activeTask.plan || []).filter(s => s.id !== sub.id && s.status === "pending");
        const isTrivialPending = pendingSubs.every(s => /tunggu|verifikasi|konfirmasi|selesai|cek/i.test(s.description || ""));
        if (pendingSubs.length > 0 && stepNum <= 2 && !isTrivialPending) {
          appendLog(`⚠️ Navigator memanggil 'finish' terlalu dini pada langkah ke-${stepNum} (masih ada ${pendingSubs.length} subtask pending). Melanjutkan subtask.`, "WARN");
          activeTask.scratchpad.push({
            step: stepNum,
            subtask: sub.id,
            observation: `Panggilan finish ditolak: masih ada ${pendingSubs.length} subtask yang belum diselesaikan di browser.`,
            action: "reject_premature_finish",
            result: "failed"
          });
          persistTask();
          continue;
        }
        await finalizeTask("done", exec.message);
        return;
      }

      // ── Stuck Detection (§ 33 PRD) ──
      const currentPageHash = `${pageData.url}|${pageData.title}|${pageData.elementsCount}`;
      if (!exec.stateChanged && activeTask.lastPageHash === currentPageHash && execActionType !== "type_text" && execActionType !== "type" && execActionType !== "press_key") {
        activeTask.stuckCounter = (activeTask.stuckCounter || 0) + 1;
        if (activeTask.stuckCounter >= 5) {
          appendLog("🛑 STUCK DETECTED: Halaman tidak berubah setelah 5 aksi berturut-turut. Mencoba strategi baru.", "WARN");
          activeTask.stuckCounter = 0;
          await tryReplanOrFail(sub, "Stuck detected: kondisi halaman web tidak merespon aksi agen.");
          continue;
        }
      } else {
        activeTask.stuckCounter = 0;
        activeTask.lastPageHash = currentPageHash;
      }

      // 9. Kegagalan → retry / replan
      if (!exec.success) {
        const retryKey = `${sub.id}`;
        activeTask.retries[retryKey] = (activeTask.retries[retryKey] || 0) + 1;

        if (exec.isLoopDetected) {
          appendLog("🛑 Circuit breaker memutus loop.", "WARN");
          await tryReplanOrFail(sub, "Aksi berulang terdeteksi (circuit breaker).");
          continue;
        }

        if (activeTask.retries[retryKey] >= CFG.MAX_RETRIES_PER_SUBTASK) {
          await tryReplanOrFail(sub, `Subtask #${sub.id} gagal: ${exec.message || 'Eksekusi DOM tidak berhasil'}`);
          continue;
        }
        appendLog(`⚠️ Step ${stepNum} gagal (${activeTask.retries[retryKey]}/${CFG.MAX_RETRIES_PER_SUBTASK}): ${exec.message || ""}`, "WARN");
        await new Promise(r => setTimeout(r, 600));
        continue;
      }

      // 10. VALIDATE
      showStatusIndicator();
      setAgentRunning(true);
      const after = await scanPage(false);
      const verdict = await runValidator(exec, exec.success ? "success" : "failed", after);

      // Update kartu validator pada pesan terakhir
      const session = getCurrentSession();
      if (session && session.messages.length > 0) {
        const lastMsg = session.messages[session.messages.length - 1];
        if (lastMsg.multiAgent) {
          lastMsg.multiAgent.validator = {
            success: verdict.verdict !== "REPLAN" && verdict.verdict !== "ASK_USER" && verdict.verdict !== "RETRY",
            message: `${verdict.verdict}: ${verdict.reason}`
          };
          updateMessageInSession(session.messages.length - 1, { multiAgent: lastMsg.multiAgent });
        }
      }

      appendLog(`🎯 Validator: ${verdict.verdict} — ${verdict.reason}`);

      // Evaluasi penyelesaian Subtask (Transisi State yang Deterministik & Anti False-Positive)
      const isNavOrMenuIntent = /(?:buka|klik|pilih|masuk|tampilkan|kunjungi|navigate|open|click)\s+(?:ke\s+)?(?:menu|sidebar|halaman|tab)?/i.test(sub.description || activeTask.goal || "");
      const isSubDone = exec.success && (
        verdict.subtaskComplete ||
        verdict.verdict === "DONE" ||
        verdict.verdict === "SUCCESS" ||
        (isNavOrMenuIntent && (execActionType === "click" || execActionType === "navigate"))
      );

      if (isSubDone) {
        markSubtask(sub.id, "done");
        refreshTaskCard();
        await persistTask();

        // Cek apakah seluruh subtask rencana telah rampung
        const remainingSubs = (activeTask.plan || []).filter(s => s.status !== "done");
        if (remainingSubs.length === 0) {
          const finalMsg = isNavOrMenuIntent
            ? `✅ Menu target telah berhasil dibuka.`
            : `✅ Seluruh langkah tugas telah berhasil diselesaikan secara tuntas.`;
          await finalizeTask("done", finalMsg);
          return;
        }
      }

      if (verdict.verdict === "DONE" && exec.success) {
        await finalizeTask("done", "✅ Validator menilai seluruh tujuan pengguna telah tercapai.");
        return;
      }
      if (verdict.verdict === "RETRY") {
        const retryKey = `${sub.id}`;
        activeTask.retries[retryKey] = (activeTask.retries[retryKey] || 0) + 1;
        if (activeTask.retries[retryKey] >= CFG.MAX_RETRIES_PER_SUBTASK) {
          await tryReplanOrFail(sub, `Validator menilai RETRY tetapi subtask #${sub.id} sudah mentok batas percobaan.`);
        }
        continue;
      }
      if (verdict.verdict === "REPLAN") {
        await tryReplanOrFail(sub, `Validator menilai strategi subtask #${sub.id} macet.`);
        continue;
      }
      if (verdict.verdict === "ASK_USER") {
        const answer = await requestAskUser(
          verdict.reason || "Dibutuhkan keputusan Anda. Bagaimana sebaiknya lanjut?",
          ["Lanjutkan seperti biasa", "Coba strategi lain", "Batalkan task"]
        );
        if (!answer || shouldStopAgent) {
          await finalizeTask("cancelled", "Task dibatalkan saat menunggu jawaban pengguna.");
          return;
        }
        if (answer.toLowerCase().includes("strategi lain")) {
          await tryReplanOrFail(sub, "Pengguna meminta strategi lain.");
        } else if (answer.toLowerCase().includes("batalkan")) {
          await finalizeTask("cancelled", "Task dibatalkan oleh pengguna.");
          return;
        }
        activeTask.clarifications.push(answer);
        activeTask.status = "EXECUTING";
        persistTask();
        continue;
      }

      // CONTINUE → lanjut langkah berikutnya
      await new Promise(r => setTimeout(r, 500));
    }

    if (activeTask && activeTask.stepsUsed >= activeTask.stepBudget && !shouldStopAgent) {
      await finalizeTask("failed", "Tugas belum dapat diselesaikan. Coba perintah yang lebih spesifik.");
    }
  }

  async function tryReplanOrFail(failedSub, reason) {
    if (!activeTask) return;
    markSubtask(failedSub.id, "failed");
    refreshTaskCard();

    if (activeTask.replansUsed >= CFG.MAX_REPLANS) {
      appendLog(`Strategi alternatif habis: ${reason}`, "WARN");
      await finalizeTask("failed", "Tugas belum dapat diselesaikan. Coba perintah yang lebih spesifik.");
      return;
    }

    activeTask.replansUsed++;
    showStatusIndicator();
    appendLog(`🔁 Re-plan ${activeTask.replansUsed}/${CFG.MAX_REPLANS}: ${reason}`, "WARN");

    try {
      const scan = await scanPage(false);
      const replanPrompt = `
[KONDISI HALAMAN SAAT INI]
Judul: ${scan.title} | URL: ${scan.url}

[RE-PLAN DIBUTUHKAN]
Subtask yang gagal: #${failedSub.id} — ${failedSub.description}
Alasan: ${reason}
Riwayat aksi terakhir:
${activeTask.scratchpad.slice(-6).map(e => `  step ${e.step} [${e.result}] ${e.observation}`).join("\n")}

Susun ulang rencana: pertahankan subtask lama yang sudah done apa adanya, ganti strategi untuk sisanya (maksimal 7 subtask total).
`.trim();

      const reply = await callLLM("plan", replanPrompt);
      const parsed = parseActionJSON(reply);
      if (parsed && Array.isArray(parsed.plan) && parsed.plan.length > 0) {
        const doneItems = activeTask.plan.filter(s => s.status === "done");
        const newItems = parsed.plan
          .map((s, i) => ({
            id: s.id || (100 + i),
            description: String(s.description || s).substring(0, 200),
            status: "pending"
          }))
          .slice(0, 7);
        activeTask.plan = [...doneItems, ...newItems].slice(0, 10);
        activeTask.retries = {};
        refreshTaskCard();
        await persistTask();
        appendLog(`🗓️ Rencana baru disusun (${activeTask.plan.length} subtask, ${doneItems.length} dipertahankan).`);
        return;
      }
    } catch (err) {
      appendLog(`Re-plan error: ${err.message}`, "ERROR");
    }
    appendLog(`Strategi alternatif gagal: ${reason}`, "ERROR");
    await finalizeTask("failed", "Tugas belum dapat diselesaikan. Coba lagi atau gunakan perintah yang lebih spesifik.");
  }

  async function finalizeTask(status, message) {
    if (!activeTask) return;

    activeTask.status = status.toUpperCase();
    refreshTaskCard();

    const isSuccess = activeTask.status === "DONE";
    const isCancelled = activeTask.status === "CANCELLED";
    const heading = isSuccess ? "✅ **Selesai**" : (isCancelled ? "⏹️ **Dihentikan**" : "⚠️ **Belum selesai**");
    const resultText = String(message || (isSuccess ? "Tugas selesai." : "Tugas belum dapat diselesaikan.")).trim();

    addMessageToCurrentSession("assistant", `${heading}\n\n${resultText}`);
    appendLog(
      `🏁 Task ${activeTask.status}: ${activeTask.goal} (${activeTask.stepsUsed} langkah)`,
      isSuccess ? "ACTION" : "WARN",
      { goal: activeTask.goal, status: activeTask.status, steps: activeTask.stepsUsed, artifacts: activeTask.artifacts?.length || 0 },
      "TASK_END"
    );

    activeTask = null;
    taskCardMsgIndex = -1;
    await clearPersistedTask();
    setAgentRunning(false);
    hideStatusIndicator();
    sendToContentScript({ type: "UNLOCK_PAGE" }).catch(() => {});
  }

  // ── Resume task dari sesi sebelumnya (checkpoint) ──
  async function resumeStoredTask() {
    try {
      const data = await chrome.storage.session.get([TASK_STORAGE_KEY]);
      const task = data?.[TASK_STORAGE_KEY];
      if (!task) return;

      activeTask = task;
      activeTask._pendingScreenshot = null;
      shouldStopAgent = false;
      taskCardMsgIndex = -1;
      setAgentRunning(true);
      showStatusIndicator();
      appendLog(`▶ Melanjutkan task tersimpan: "${activeTask.goal}" (${activeTask.stepsUsed}/${activeTask.stepBudget} langkah)`);
      await executeTaskLoop();
    } catch (err) {
      appendLog(`Resume error: ${err.message}`, "ERROR");
    }
  }

  // Tombol resume dirender via event delegation (kartu resume)
  chatArea.addEventListener("click", (e) => {
    const resumeBtn = e.target.closest("[data-resume-task]");
    if (resumeBtn && !isAgentRunning) {
      resumeStoredTask();
      return;
    }
  });

  // ═══════════════════════════════════════════════════
  // QUICK CHIPS
  // ═══════════════════════════════════════════════════
  function applyPromptToInput(text) {
    promptInput.value = text;
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(Math.max(promptInput.scrollHeight, 38), 150) + "px";
    promptInput.focus();
  }

  function initQuickChipsSlider() {
    if (!quickChipsContainer) return;

    const updateSliderArrows = () => {
      const { scrollLeft, scrollWidth, clientWidth } = quickChipsContainer;
      if (btnSlideChipsLeft) {
        btnSlideChipsLeft.classList.toggle("hidden", scrollLeft <= 4);
      }
      if (btnSlideChipsRight) {
        btnSlideChipsRight.classList.toggle("hidden", scrollLeft + clientWidth >= scrollWidth - 4);
      }
    };

    if (btnSlideChipsLeft) {
      btnSlideChipsLeft.addEventListener("click", () => {
        quickChipsContainer.scrollBy({ left: -140, behavior: "smooth" });
      });
    }

    if (btnSlideChipsRight) {
      btnSlideChipsRight.addEventListener("click", () => {
        quickChipsContainer.scrollBy({ left: 140, behavior: "smooth" });
      });
    }

    quickChipsContainer.addEventListener("scroll", updateSliderArrows, { passive: true });

    // Mouse drag-to-scroll
    let isDown = false;
    let startX = 0;
    let scrollLeftVal = 0;

    quickChipsContainer.addEventListener("mousedown", (e) => {
      isDown = true;
      quickChipsContainer.classList.add("is-dragging");
      startX = e.pageX - quickChipsContainer.offsetLeft;
      scrollLeftVal = quickChipsContainer.scrollLeft;
    });

    window.addEventListener("mouseup", () => {
      if (isDown) {
        isDown = false;
        quickChipsContainer.classList.remove("is-dragging");
      }
    });

    quickChipsContainer.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - quickChipsContainer.offsetLeft;
      const walk = (x - startX) * 1.5;
      quickChipsContainer.scrollLeft = scrollLeftVal - walk;
    });

    // Horizontal mouse wheel
    quickChipsContainer.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        quickChipsContainer.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    setTimeout(updateSliderArrows, 120);
    window.addEventListener("resize", updateSliderArrows);
  }

  if (chipSummarize) {
    chipSummarize.addEventListener("click", () => {
      applyPromptToInput("Tolong buat ringkasan poin-poin penting dari isi konten halaman web ini.");
      handleSend();
    });
  }

  if (chipExtract) {
    chipExtract.addEventListener("click", () => {
      applyPromptToInput("Tolong ekstrak data atau tabel penting dari halaman ini dalam format tabel Markdown.");
      handleSend();
    });
  }

  if (chipAutoFill) {
    chipAutoFill.addEventListener("click", () => {
      applyPromptToInput("Tolong bantu jelaskan dan isi kolom formulir pada halaman ini.");
      handleSend();
    });
  }

  if (chipAuditSecurity) {
    chipAuditSecurity.addEventListener("click", () => {
      applyPromptToInput("Tolong lakukan audit keamanan, resource server, dan status pada halaman ini. Berikan temuan serta rekomendasi perbaikan.");
      handleSend();
    });
  }

  if (chipSeoAnalysis) {
    chipSeoAnalysis.addEventListener("click", () => {
      applyPromptToInput("Tolong lakukan audit dan analisis SEO pada halaman ini: title, meta tag, struktur konten, dan rekomendasi optimasi.");
      handleSend();
    });
  }

  if (chipCopyText) {
    chipCopyText.addEventListener("click", () => {
      applyPromptToInput("Tolong ekstrak dan salin seluruh teks konten utama dari halaman web ini secara bersih.");
      handleSend();
    });
  }

  if (chipToggleMarkers) {
    chipToggleMarkers.addEventListener("click", async () => {
      markersVisible = !markersVisible;
      if (markersVisible) {
        await sendToContentScript({ type: "SCAN_DOM", showOverlay: true });
        appendLog("Marker visual diaktifkan.");
      } else {
        await sendToContentScript({ type: "CLEAR_MARKERS" });
        appendLog("Marker visual dibersihkan.");
      }
    });
  }

  // ═══════════════════════════════════════════════════
  // UNIVERSAL @MENTION & FILE INGESTION (Perplexity-Grade)
  // ═══════════════════════════════════════════════════
  let mentionQueryCounter = 0; // Race condition prevention

  function renderComposerChips() {
    if (!composerChipsTray) return;
    composerChipsTray.innerHTML = "";
    if (attachedContextSources.length === 0) {
      composerChipsTray.classList.add("hidden");
      return;
    }
    composerChipsTray.classList.remove("hidden");
    attachedContextSources.forEach((src, idx) => {
      const chip = document.createElement("div");
      chip.className = "composer-chip";

      let icon = "📎";
      if (src.type === "Image") icon = "🖼️";
      else if (src.type === "BrowserTab" || src.type === "tab") icon = "🌐";
      else if (src.type === "Connector") icon = src.metadata?.icon || "⚡";
      else {
        const ext = (src.name || "").split(".").pop().toLowerCase();
        if (ext === "pdf") icon = "📕";
        else if (ext === "csv" || ext === "xlsx" || ext === "xls") icon = "📊";
        else if (ext === "doc" || ext === "docx") icon = "📘";
        else if (ext === "json" || ext === "js" || ext === "ts" || ext === "html") icon = "📄";
      }

      const displayName = src.name || src.title || "File";
      const sizeStr = src.metadata?.sizeFormatted || (src.metadata?.size ? `${Math.round(src.metadata.size / 1024)} KB` : "");

      chip.innerHTML = `
        <span class="chip-icon">${icon}</span>
        <div class="chip-info">
          <span class="chip-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
          ${sizeStr ? `<span class="chip-meta">${sizeStr}</span>` : ""}
        </div>
        <button type="button" class="chip-remove" title="Hapus lampiran">✕</button>
      `;

      chip.querySelector(".chip-remove")?.addEventListener("click", (e) => {
        e.stopPropagation();
        attachedContextSources.splice(idx, 1);
        renderComposerChips();
      });
      composerChipsTray.appendChild(chip);
    });
  }

  function renderMentionItemIcon(src) {
    if (src.type === "Connector") {
      const emoji = src.metadata?.icon || "⚡";
      return `<div class="mention-item-icon-wrap"><span class="mention-icon-emoji">${emoji}</span></div>`;
    }
    const favUrl = src.metadata?.favIconUrl || src.icon;
    if (favUrl && typeof favUrl === "string" && !favUrl.startsWith("chrome://") && favUrl !== "🌐") {
      return `<div class="mention-item-icon-wrap"><img src="${escapeHtml(favUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';" /><span class="mention-icon-fallback" style="display:none;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></span></div>`;
    }
    return `<div class="mention-item-icon-wrap"><span class="mention-icon-fallback"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></span></div>`;
  }

  function renderMentionPickerDOM(groups) {
    if (!mentionPickerList) return;
    mentionPickerList.innerHTML = "";
    currentFilteredMentionSources = [];
    let globalIdx = 0;

    for (const group of groups) {
      if (!group.items || group.items.length === 0) continue;

      // Group header
      const header = document.createElement("div");
      header.className = "mention-picker-group-title";
      header.textContent = group.title;
      mentionPickerList.appendChild(header);

      for (const src of group.items) {
        const flatIdx = globalIdx++;
        currentFilteredMentionSources.push(src);

        const item = document.createElement("div");
        item.className = `mention-picker-item${flatIdx === 0 ? " active" : ""}`;
        item.setAttribute("data-flat-index", flatIdx);

        const titleText = src.title || src.metadata?.title || src.name;
        const subText = src.metadata?.domain || src.subtitle || src.metadata?.description || src.url || "";
        const badge = (src.type === "BrowserTab" || src.type === "tab")
          ? (src.metadata?.active ? "Aktif" : (src.name ? `@${src.name}` : "Tab"))
          : (src.type === "Connector" ? "Konektor" : "");

        item.innerHTML = `
          ${renderMentionItemIcon(src)}
          <div class="mention-item-info">
            <div class="mention-item-title-row">
              <span class="mention-item-title">${escapeHtml(titleText)}</span>
              ${badge ? `<span class="mention-item-badge">${escapeHtml(badge)}</span>` : ""}
            </div>
            <span class="mention-item-sub">${escapeHtml(subText)}</span>
          </div>
        `;

        item.addEventListener("click", () => selectMentionSource(src));
        mentionPickerList.appendChild(item);
      }
    }

    if (currentFilteredMentionSources.length === 0) {
      mentionPickerList.innerHTML = `<div class="mention-empty-state">Tidak ada tab atau konektor yang cocok</div>`;
    }

    mentionActiveIndex = 0;
    mentionPicker?.classList.remove("hidden");
  }

  async function openMentionPicker(query = "") {
    if (!mentionPicker || !mentionPickerList) return;
    mentionQuery = query;

    const thisQuery = ++mentionQueryCounter;

    let groups = [];
    if (typeof PesatContextEngine !== "undefined") {
      const { connectors, tabs } = await PesatContextEngine.getFilteredGrouped(query);
      if (thisQuery !== mentionQueryCounter) return; // stale result
      groups = [
        { title: "Connectors", items: connectors },
        { title: "Browser Tabs", items: tabs.slice(0, 20) }
      ];
    }

    renderMentionPickerDOM(groups);
  }

  function closeMentionPicker() {
    if (mentionPicker) mentionPicker.classList.add("hidden");
    currentFilteredMentionSources = [];
    mentionQuery = "";
    mentionActiveIndex = 0;
  }

  // ── Caret-aware @ detection helpers ──
  function findMentionTrigger() {
    const pos = promptInput.selectionStart;
    if (pos == null) return null;
    const val = promptInput.value;

    // Walk backwards from caret to find '@'
    let atPos = -1;
    for (let i = pos - 1; i >= 0; i--) {
      const ch = val[i];
      if (ch === "@") {
        // Must be at start of input or preceded by whitespace
        if (i === 0 || /\s/.test(val[i - 1])) {
          atPos = i;
        }
        break;
      }
      if (/\s/.test(ch)) break; // hit space before @
    }

    if (atPos < 0) return null;

    const queryPart = val.slice(atPos + 1, pos);
    if (/\s/.test(queryPart)) return null; // space inside query = no longer active

    return { atPos, query: queryPart };
  }

  function selectMentionSource(source) {
    if (!source) return;
    if (!attachedContextSources.some(s => s.id === source.id)) {
      attachedContextSources.push(source);
      renderComposerChips();
    }

    // Smart insertion: replace @query with @Name at caret position, preserving surrounding text
    const val = promptInput.value;
    const pos = promptInput.selectionStart ?? val.length;
    const trigger = findMentionTrigger();
    const mentionName = source.name || (source.metadata?.index ? `tab${source.metadata.index}` : (source.title || "tab").replace(/\s+/g, "_"));

    let before, after, insertText;
    if (trigger) {
      before = val.slice(0, trigger.atPos);
      after = val.slice(pos);
      insertText = `@${mentionName} `;
    } else {
      before = val.slice(0, pos);
      after = val.slice(pos);
      const needSpace = pos > 0 && !/\s/.test(val[pos - 1]);
      insertText = `${needSpace ? " " : ""}@${mentionName} `;
    }

    if (insertText.endsWith(" ") && after.startsWith(" ")) {
      after = after.slice(1);
    }

    promptInput.value = before + insertText + after;
    const newPos = before.length + insertText.length;
    promptInput.setSelectionRange(newPos, newPos);

    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(Math.max(promptInput.scrollHeight, 38), 140) + "px";

    closeMentionPicker();
    promptInput.focus();
  }

  async function handleIncomingFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      showStatusIndicator("Membaca file lampiran...");
      try {
        if (typeof PesatFileEngine !== "undefined" && typeof PesatContextEngine !== "undefined") {
          const processed = await PesatFileEngine.processLocalFile(file);
          const sizeKb = Math.round(file.size / 1024);
          const sizeFormatted = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb || 1} KB`;
          const source = PesatContextEngine.createContextSource({
            type: processed.type === "image" ? "Image" : "File",
            name: file.name,
            title: file.name,
            content: processed.content || "",
            metadata: {
              fileName: file.name,
              fileType: processed.type,
              size: file.size,
              sizeFormatted: sizeFormatted,
              summary: `${(processed.type || "file").toUpperCase()}, ${sizeFormatted}`,
              content: processed.content || "",
              extractedText: processed.content || "",
              fullText: processed.content || "",
              sampleText: (processed.content || "").substring(0, 500),
              dataUrl: processed.dataUrl || null
            }
          });
          attachedContextSources.push(source);
          appendLog(`📎 File berhasil dilampirkan: ${file.name} (${sizeFormatted})`);
        }
      } catch (err) {
        appendLog(`Gagal memproses file ${file.name}: ${err.message}`, "WARN");
      }
    }
    hideStatusIndicator();
    renderComposerChips();
  }

  // ── Event Listeners Mention & Files ──
  if (btnTriggerMention) {
    btnTriggerMention.addEventListener("click", (e) => {
      e.stopPropagation();
      promptInput.focus();
      openMentionPicker("");
    });
  }

  // Klik di luar mention picker untuk menutup
  document.addEventListener("click", (e) => {
    if (mentionPicker && !mentionPicker.classList.contains("hidden")) {
      if (!mentionPicker.contains(e.target) && e.target !== btnTriggerMention && e.target !== promptInput) {
        closeMentionPicker();
      }
    }
  });

  if (btnAttachFile && fileInput) {
    btnAttachFile.addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", (e) => {
      handleIncomingFiles(e.target.files);
      fileInput.value = "";
    });
  }

  // Drag and drop overlay (§ 5, 11)
  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    if (dropOverlay) dropOverlay.classList.remove("hidden");
  });
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  window.addEventListener("dragleave", (e) => {
    if (e.relatedTarget === null && dropOverlay) {
      dropOverlay.classList.add("hidden");
    }
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (dropOverlay) dropOverlay.classList.add("hidden");
    if (e.dataTransfer?.files?.length > 0) {
      handleIncomingFiles(e.dataTransfer.files);
    }
  });

  // Clipboard paste with image/files
  promptInput.addEventListener("paste", (e) => {
    if (e.clipboardData?.files?.length > 0) {
      e.preventDefault();
      handleIncomingFiles(e.clipboardData.files);
    }
  });

  // Runtime Message Observer Listener (Download & Token Usage)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "TOKEN_UPDATE" && msg.usage) {
      updateTokenTrackerUI(msg.usage);
      return;
    }

    if (msg && msg.action === "DOWNLOAD_COMPLETED_EVENT" && msg.downloadItem) {
      const item = msg.downloadItem;
      appendLog(`⬇️ Download terdeteksi selesai: ${item.filename} (${item.fileSize} bytes)`);
      if (typeof PesatContextEngine !== "undefined") {
        const downloadSource = PesatContextEngine.createContextSource({
          type: "Download",
          name: item.filename,
          metadata: { ...item }
        });
        if (activeTask) {
          activeTask.contextSources.push(downloadSource);
          activeTask.scratchpad.push({
            step: activeTask.stepsUsed,
            subtask: activeTask.currentSubtask,
            observation: `File terunduh dari browser: ${item.filename} (${item.fileSize} bytes)`,
            action: "download_complete",
            result: "success"
          });
          persistTask();
        }
      }
    }
  });

  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(Math.max(promptInput.scrollHeight, 38), 140) + "px";

    const trigger = findMentionTrigger();
    if (trigger) {
      openMentionPicker(trigger.query);
    } else {
      closeMentionPicker();
    }
  });

  promptInput.addEventListener("keydown", (e) => {
    // Navigasi keyboard mention picker
    if (mentionPicker && !mentionPicker.classList.contains("hidden") && currentFilteredMentionSources.length > 0) {
      const items = mentionPickerList?.querySelectorAll(".mention-picker-item");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        mentionActiveIndex = (mentionActiveIndex + 1) % currentFilteredMentionSources.length;
        items?.forEach((it, idx) => it.classList.toggle("active", idx === mentionActiveIndex));
        items?.[mentionActiveIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        mentionActiveIndex = (mentionActiveIndex - 1 + currentFilteredMentionSources.length) % currentFilteredMentionSources.length;
        items?.forEach((it, idx) => it.classList.toggle("active", idx === mentionActiveIndex));
        items?.[mentionActiveIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const sel = currentFilteredMentionSources[mentionActiveIndex];
        if (sel) selectMentionSource(sel);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMentionPicker();
        return;
      }
    }

    if (e.key === "Escape" && isAgentRunning) {
      e.preventDefault();
      abortAgentExecution("Pengguna menekan tombol Escape.");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isAgentRunning) {
        handleSend();
      }
    }
  });

  // ═══════════════════════════════════════════════════
  // HELPERS: STATUS, STOP, LOG, ABORT
  // ═══════════════════════════════════════════════════
  function setAgentRunning(running) {
    isAgentRunning = running;
    agentStatus.textContent = running ? "Bekerja" : "Siap";
    if (running) {
      agentStatus.classList.add("working");
      stopBar.classList.remove("hidden");
      if (btnSend) {
        btnSend.classList.add("stop-btn");
        btnSend.title = "Hentikan / Batal Proses AI (Klik untuk STOP)";
        btnSend.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="2" ry="2"></rect>
          </svg>
        `;
      }
      sendToContentScript({
        type: "LOCK_PAGE",
        message: "Tab ini sedang dikontrol oleh Pesat AI Agent... (Halaman dikunci agar AI fokus)"
      }).catch(() => {});
    } else {
      agentStatus.classList.remove("working");
      stopBar.classList.add("hidden");
      if (btnSend) {
        btnSend.classList.remove("stop-btn");
        btnSend.title = "Kirim Perintah (Enter)";
        btnSend.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        `;
      }
      sendToContentScript({ type: "UNLOCK_PAGE" }).catch(() => {});
    }
  }

  function abortAgentExecution(reason = "Otomatisasi dihentikan oleh pengguna.") {
    shouldStopAgent = true;
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch (e) {}
      activeAbortController = null;
    }
    if (planApprovalResolver) { planApprovalResolver(false); planApprovalResolver = null; }
    if (askUserResolver) { askUserResolver(null); askUserResolver = null; }
    if (confirmResolver) { confirmResolver({ approved: false, cancelled: true }); confirmResolver = null; }
    if (activeTask) {
      activeTask.status = "PAUSED";
      refreshTaskCard();
      appendLog(`🛑 Task dihentikan: ${reason}`, "WARN");
      persistTask();
      activeTask = null;
      taskCardMsgIndex = -1;
    }
    setAgentRunning(false);
    hideStatusIndicator();

    // Kirim sinyal ABORT_AGENT_LOOP ke background.js dan content script
    try {
      chrome.runtime.sendMessage({ action: "ABORT_AGENT_LOOP", type: "ABORT_AGENT_LOOP", reason });
    } catch (_) {}
    sendToContentScript({ type: "UNLOCK_PAGE" }).catch(() => {});
    sendToContentScript({ type: "CLEAR_MARKERS" }).catch(() => {});
    appendLog(`🛑 ${reason}`);
  }

  btnStopAgent.addEventListener("click", () => {
    abortAgentExecution("Otomatisasi dihentikan via Stop Bar.");
  });

  function appendLog(logText, level = "INFO", details = null, type = "EVENT") {
    if (typeof PesatLogger !== "undefined" && typeof PesatLogger.sendRemoteLog === "function") {
      PesatLogger.sendRemoteLog({
        level,
        source: "SIDEPANEL",
        type,
        message: logText,
        details,
        sessionId: currentSessionId
      });
    }

    if (logContent) {
      if (logContent.querySelector(".log-empty")) {
        logContent.innerHTML = "";
      }
      const logItem = document.createElement("div");
      logItem.className = "log-item";
      const time = new Date().toLocaleTimeString();
      logItem.textContent = `[${time}] ${logText}`;
      logContent.appendChild(logItem);
      logContent.scrollTop = logContent.scrollHeight;
    }
  }

  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ═══════════════════════════════════════════════════
  // HEADER & DRAWERS & EXPORT
  // ═══════════════════════════════════════════════════
  btnNewChat.addEventListener("click", () => createNewSession());
  btnDrawerNewChat.addEventListener("click", () => createNewSession());

  btnHistory.addEventListener("click", () => {
    historyDrawer.classList.toggle("hidden");
  });
  btnCloseHistory.addEventListener("click", () => {
    historyDrawer.classList.add("hidden");
  });
  btnClearHistory.addEventListener("click", async () => {
    if (confirm("Hapus semua riwayat percakapan?")) {
      sessions = [];
      createNewSession();
    }
  });

  btnSettings.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
    refreshGoogleStatus();
  });

  const composerModelDropdown = document.getElementById("composerModelDropdown");
  const modelDropdownList = document.getElementById("modelDropdownList");
  const btnOpenSettingsFromPill = document.getElementById("btnOpenSettingsFromPill");

  if (btnComposerModel && composerModelDropdown) {
    btnComposerModel.addEventListener("click", (e) => {
      e.stopPropagation();
      composerModelDropdown.classList.toggle("hidden");
    });
  }

  if (btnOpenSettingsFromPill) {
    btnOpenSettingsFromPill.addEventListener("click", () => {
      composerModelDropdown?.classList.add("hidden");
      settingsPanel?.classList.remove("hidden");
      refreshGoogleStatus();
    });
  }

  if (modelDropdownList) {
    modelDropdownList.addEventListener("click", async (e) => {
      e.stopPropagation();
      const optBtn = e.target.closest(".model-option-btn");
      if (!optBtn) return;
      const modelId = optBtn.getAttribute("data-model");
      if (modelId) {
        activeModelId = modelId;
        if (typeof storedSettings !== "undefined" && storedSettings) storedSettings.modelName = modelId;
        if (composerModelName) composerModelName.textContent = modelId;
        if (typeof modelNameInput !== "undefined" && modelNameInput) modelNameInput.value = modelId;
        modelDropdownList.querySelectorAll(".model-option-btn").forEach(b => b.classList.remove("active"));
        optBtn.classList.add("active");
        if (composerModelDropdown) composerModelDropdown.classList.add("hidden");
        appendLog(`Model AI dialihkan ke: ${modelId}`);
        try {
          await chrome.storage.local.set({ modelName: modelId });
        } catch (_) {}
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (composerModelDropdown && !composerModelDropdown.contains(e.target) && e.target !== btnComposerModel) {
      composerModelDropdown.classList.add("hidden");
    }
  });

  async function checkPendingPrompt() {
    try {
      const storageArea = (chrome.storage && chrome.storage.session) ? chrome.storage.session : chrome.storage.local;
      const data = await storageArea.get(["pesat_pending_prompt"]);
      if (data && data.pesat_pending_prompt && data.pesat_pending_prompt.prompt) {
        const prompt = data.pesat_pending_prompt.prompt;
        await storageArea.remove(["pesat_pending_prompt"]);
        if (promptInput) {
          promptInput.value = prompt;
          autoResizeTextarea();
          promptInput.focus();
        }
      }
    } catch (_) {}
  }

  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === "INJECT_PENDING_PROMPT" && msg.prompt) {
        if (promptInput) {
          promptInput.value = msg.prompt;
          autoResizeTextarea();
          promptInput.focus();
        }
      }
    });
  }

  btnCloseSettings.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
  });
  btnCancelSettings.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
  });

  // Global UX Keyboard Handler: Tutup dialog dengan tombol Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (settingsPanel && !settingsPanel.classList.contains("hidden")) {
        settingsPanel.classList.add("hidden");
      }
      if (historyDrawer && !historyDrawer.classList.contains("hidden")) {
        historyDrawer.classList.add("hidden");
      }
    }
  });

  if (logToggle && logContent) {
    logToggle.addEventListener("click", () => {
      const isHidden = logContent.classList.toggle("hidden");
      if (logIcon) logIcon.textContent = isHidden ? "▼" : "▲";
    });
  }

  const btnExportHistory = document.getElementById("btnExportHistory");
  if (btnExportHistory) {
    btnExportHistory.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessions, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `pesat_agent_history_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      appendLog("📥 Riwayat percakapan berhasil diekspor.");
    });
  }

  // ── Onboarding Wizard Extra Controls ──
  if (btnWizardClose && onboardingModal) {
    btnWizardClose.addEventListener("click", () => {
      onboardingModal.classList.add("hidden");
    });
  }
  if (onboardingModal) {
    onboardingModal.addEventListener("click", (e) => {
      if (e.target === onboardingModal) {
        onboardingModal.classList.add("hidden");
      }
    });
  }
  if (btnWizardMore) {
    btnWizardMore.addEventListener("click", () => {
      settingsPanel?.classList.toggle("hidden");
    });
  }
  if (wizardProviderToggle) {
    wizardProviderToggle.addEventListener("change", (e) => {
      if (settingsProviderToggle) settingsProviderToggle.checked = e.target.checked;
      appendLog(e.target.checked ? "Provider PesatRouter diaktifkan." : "Provider PesatRouter dinonaktifkan.");
    });
  }
  if (settingsProviderToggle) {
    settingsProviderToggle.addEventListener("change", (e) => {
      if (wizardProviderToggle) wizardProviderToggle.checked = e.target.checked;
      appendLog(e.target.checked ? "Provider PesatRouter diaktifkan." : "Provider PesatRouter dinonaktifkan.");
    });
  }

  // ═══════════════════════════════════════════════════
  // INITIALIZATION (Runs after all variables & functions are declared)
  // ═══════════════════════════════════════════════════
  await loadSettings();
  await loadSessions();
  await refreshGoogleStatus();
  await loadResumableTask();
  await refreshUsageDisplay();
  attachSuggestionListeners();
  initQuickChipsSlider();
  checkOnboarding();
  await checkPendingPrompt();
  appendLog("Sesi ekstensi v5.2 (Direct PesatRouter BYOK) diaktifkan.", "INFO", { timestamp: Date.now() }, "SESSION_OPEN");

  btnSend.addEventListener("click", () => {
    if (isAgentRunning) {
      abortAgentExecution("Pengguna menghentikan proses via tombol Stop.");
    } else {
      handleSend();
    }
  });
});
