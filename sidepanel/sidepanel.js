// sidepanel.js - Pesat AI Browser Agent (Modern UI, Marked.js, Action Indicator, & Responsive Tables)

document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const chatArea = document.getElementById("chatArea");
  const promptInput = document.getElementById("promptInput");
  const btnSend = document.getElementById("btnSend");
  const agentStatus = document.getElementById("agentStatus");
  const logToggle = document.getElementById("logToggle");
  const logContent = document.getElementById("logContent");
  const logIcon = document.getElementById("logIcon");
  const stopBar = document.getElementById("stopBar");
  const btnStopAgent = document.getElementById("btnStopAgent");

  // Status Indicator Element (Floating UX Loader)
  const agentStatusIndicator = document.getElementById("agentStatusIndicator");
  const statusIndicatorText = document.getElementById("statusIndicatorText");

  // Header Action Buttons
  const btnNewChat = document.getElementById("btnNewChat");
  const btnHistory = document.getElementById("btnHistory");
  const btnSettings = document.getElementById("btnSettings");

  // History Drawer Elements
  const historyDrawer = document.getElementById("historyDrawer");
  const btnCloseHistory = document.getElementById("btnCloseHistory");
  const btnDrawerNewChat = document.getElementById("btnDrawerNewChat");
  const sessionList = document.getElementById("sessionList");
  const btnClearHistory = document.getElementById("btnClearHistory");

  // Settings Panel Elements
  const settingsPanel = document.getElementById("settingsPanel");
  const btnCloseSettings = document.getElementById("btnCloseSettings");
  const btnCancelSettings = document.getElementById("btnCancelSettings");
  const btnSaveSettings = document.getElementById("btnSaveSettings");
  const apiUrlInput = document.getElementById("apiUrlInput");
  const apiKeyInput = document.getElementById("apiKeyInput");

  // Quick Action Chips
  const chipSummarize = document.getElementById("chipSummarize");
  const chipExtract = document.getElementById("chipExtract");
  const chipAutoFill = document.getElementById("chipAutoFill");
  const chipToggleMarkers = document.getElementById("chipToggleMarkers");

  // State
  let currentSessionId = null;
  let sessions = [];
  let isAgentRunning = false;
  let shouldStopAgent = false;
  let markersVisible = false;
  let activeAbortController = null;

  // Initialize
  await loadSettings();
  await loadSessions();
  attachSuggestionListeners();
  appendLog("Sesi ekstensi diaktifkan oleh pengguna.", "INFO", { timestamp: Date.now() }, "SESSION_OPEN");

  // ----------------------------------------------------
  // 4. Markdown & Responsive Table Parser (marked.js Integration)
  // ----------------------------------------------------
  function parseMarkdown(text) {
    if (!text) return "";

    let rawHtml = "";

    // 1. Coba parse dengan marked.js
    if (typeof marked !== "undefined" && typeof marked.parse === "function") {
      try {
        rawHtml = marked.parse(text, { breaks: true, gfm: true });
      } catch (err) {
        console.warn("[Pesat] marked.parse failed, falling back:", err);
        rawHtml = fallbackMarkdown(text);
      }
    } else {
      rawHtml = fallbackMarkdown(text);
    }

    // 2. Wrap semua <table> ke dalam <div class="table-container"> (Mencegah potong horizontal)
    rawHtml = wrapTablesWithResponsiveContainer(rawHtml);

    return rawHtml;
  }

  // Helper Fallback Markdown jika marked.js tidak tersedia
  function fallbackMarkdown(text) {
    let html = escapeHtml(text);

    // Code blocks
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // Bullet lists
    html = html.replace(/^\s*[\*\-]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Markdown Tables manual parser
    if (html.includes('|')) {
      const lines = html.split('\n');
      let inTable = false;
      let isFirstRow = true;
      let tableHtml = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
          if (!inTable) {
            inTable = true;
            isFirstRow = true;
            tableHtml += '<table>';
          }
          if (line.includes('---') || line.includes(':---') || line.includes('---:')) {
            isFirstRow = false;
            continue;
          }

          const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          const tag = isFirstRow ? 'th' : 'td';
          tableHtml += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
          if (isFirstRow) isFirstRow = false;
        } else {
          if (inTable) {
            inTable = false;
            tableHtml += '</table>';
          }
          tableHtml += (line ? line + '<br>' : '<br>');
        }
      }
      if (inTable) tableHtml += '</table>';
      html = tableHtml;
    } else {
      html = html.replace(/\n/g, '<br>');
    }

    return html;
  }

  // Helper: Pastikan setiap <table> dibungkus .table-container
  function wrapTablesWithResponsiveContainer(html) {
    if (!html.includes("<table")) return html;

    // Jika sudah di dalam table-container, hindari double wrap
    if (html.includes('class="table-container"')) return html;

    return html.replace(/(<table[\s\S]*?<\/table>)/gi, (match) => {
      return `<div class="table-container">${match}</div>`;
    });
  }

  // ----------------------------------------------------
  // 2. Status Indicator Helper
  // ----------------------------------------------------
  function showStatusIndicator(text) {
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

  // ----------------------------------------------------
  // Session & History Management
  // ----------------------------------------------------
  async function loadSessions() {
    const data = await chrome.storage.local.get(["agent_sessions", "current_session_id"]);
    sessions = data.agent_sessions || [];
    currentSessionId = data.current_session_id || null;

    if (!currentSessionId || !sessions.find(s => s.id === currentSessionId)) {
      createNewSession();
    } else {
      renderCurrentSession();
    }
    renderSessionList();
  }

  async function saveSessions() {
    // Session Pruning: Batasi maksimum 30 sesi terbaru agar storage tidak overflow
    if (sessions.length > 30) {
      sessions = sessions.slice(0, 30);
    }
    await chrome.storage.local.set({
      agent_sessions: sessions,
      current_session_id: currentSessionId
    });
    renderSessionList();
  }

  function createNewSession() {
    // Pastikan state running selalu direset saat buka sesi baru
    if (activeAbortController) {
      try { activeAbortController.abort(); } catch (e) {}
      activeAbortController = null;
    }
    setAgentRunning(false);
    hideStatusIndicator();
    shouldStopAgent = true;

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
    appendLog("Konteks obrolan baru dimulai.");
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
      renderMessageBubble(msg, idx);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function renderWelcomeMessage() {
    chatArea.innerHTML = `
      <div class="message assistant-message" id="welcomeMessage">
        <div class="message-bubble welcome-card">
          <div class="welcome-header">
            <span class="welcome-badge">Pesat.AI</span>
            <span class="welcome-title">Halo! Saya Pesat AI Agent ⚡</span>
          </div>
          <p class="welcome-desc">
            Asisten browser otonom cerdas dengan arsitektur Multi-Agent (Planner, Navigator, & Validator) untuk membantu otomasi web Anda secara presisi.
          </p>
          <div class="welcome-suggestions">
            <div class="suggestion-item" data-prompt="Tolong berikan ringkasan poin-poin utama dari isi konten halaman web ini dalam format Markdown yang rapi dengan bullet points.">
              <span class="suggestion-icon">💡</span>
              <div class="suggestion-text">
                <span class="suggestion-title">Rangkum web ini</span>
                <span class="suggestion-sub">Ekstraksi poin-poin esensial konten</span>
              </div>
            </div>
            <div class="suggestion-item" data-prompt="Tolong ekstrak data atau tabel penting yang ada pada halaman ini dan sajikan dalam format tabel Markdown.">
              <span class="suggestion-icon">📊</span>
              <div class="suggestion-text">
                <span class="suggestion-title">Ekstrak tabel</span>
                <span class="suggestion-sub">Konversi data web ke tabel rapi</span>
              </div>
            </div>
            <div class="suggestion-item" data-prompt="Tolong periksa kolom input atau formulir pada halaman ini, lalu pandu saya cara mengisinya.">
              <span class="suggestion-icon">📝</span>
              <div class="suggestion-text">
                <span class="suggestion-title">Bantu isi formulir</span>
                <span class="suggestion-sub">Otomasi pengisian field interaktif</span>
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

      item.querySelector(".session-info").addEventListener("click", () => {
        currentSessionId = sess.id;
        saveSessions();
        renderCurrentSession();
        historyDrawer.classList.add("hidden");
      });

      item.querySelector(".session-delete").addEventListener("click", (e) => {
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

  // ----------------------------------------------------
  // Message Rendering & Multi-Agent UI Cards
  // ----------------------------------------------------
  function renderMessageBubble(msg, index) {
    const isUser = msg.role === "user";
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${isUser ? "user-message" : "assistant-message"}`;
    msgDiv.dataset.index = index;

    let contentHtml = "";

    if (isUser) {
      contentHtml = `<div class="message-bubble">${escapeHtml(msg.content)}</div>`;
    } else if (msg.askUser) {
      // Render Human-in-the-Loop Clarification Question & Interactive Option Chips
      const { question, options } = msg.askUser;
      let askHtml = `
        <div class="message-bubble">
          <div class="ask-user-container">
            <div class="ask-user-question">🤔 ${escapeHtml(question || msg.content)}</div>
      `;

      if (Array.isArray(options) && options.length > 0) {
        askHtml += `<div class="ask-user-options">`;
        options.forEach((opt) => {
          askHtml += `<button class="ask-user-option-btn" data-answer="${escapeHtml(opt)}">⚡ ${escapeHtml(opt)}</button>`;
        });
        askHtml += `</div>`;
      }

      askHtml += `
          </div>
        </div>
      `;
      contentHtml = askHtml;
    } else if (msg.multiAgent) {
      // Render Multi-Agent Pipeline Cards (Planner, Navigator, Validator)
      const { planner, navigator, validator, finalAnswer } = msg.multiAgent;
      let pipelineHtml = '<div class="agent-pipeline-container">';

      if (planner && planner.steps && planner.steps.length > 0) {
        pipelineHtml += `
          <div class="agent-card planner">
            <div class="agent-card-header">🧠 Planner Agent</div>
            <div class="agent-card-body">
              <div><strong>Rencana Aksi:</strong></div>
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
              ${navigator.status ? `<div style="font-size:13.5px; color:#c7d2fe; margin-top:4px;">Status: ${escapeHtml(navigator.status)}</div>` : ''}
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
      // Normal Assistant Markdown Message
      contentHtml = `<div class="message-bubble markdown-body">${parseMarkdown(msg.content)}</div>`;
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
      // Attach click listener ke tombol opsi Human-in-the-Loop
      const optionBtns = msgDiv.querySelectorAll(".ask-user-option-btn");
      optionBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const selectedAnswer = btn.getAttribute("data-answer");
          if (selectedAnswer && !isAgentRunning) {
            promptInput.value = selectedAnswer;
            handleSend();
          }
        });
      });
    }

    chatArea.appendChild(msgDiv);
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
    if (!text || typeof text !== "string") return text || "";
    const trimmed = text.trim();
    // Jika formatnya JSON mentah {"action": "finish", "message": "..."}
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.message) return parsed.message;
        if (parsed.answer) return parsed.answer;
        if (parsed.final_answer) return parsed.final_answer;
      } catch (e) {}
    }
    // Jika di dalam code block ```json ... ```
    const jsonBlock = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock[1]);
        if (parsed.message) return parsed.message;
        if (parsed.answer) return parsed.answer;
        if (parsed.final_answer) return parsed.final_answer;
      } catch (e) {}
    }
    return text;
  }

  function addMessageToCurrentSession(role, content, multiAgent = null, askUser = null) {
    const session = getCurrentSession();
    if (!session) return;

    const cleanContent = role === "assistant" ? cleanAssistantReply(content) : content;
    const msgObj = { role, content: cleanContent, timestamp: Date.now(), multiAgent, askUser };
    session.messages.push(msgObj);

    if (session.messages.length === 1 && role === "user") {
      session.title = content.substring(0, 32) + (content.length > 32 ? "..." : "");
    }

    session.timestamp = Date.now();
    saveSessions();
    renderMessageBubble(msgObj, session.messages.length - 1);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // ----------------------------------------------------
  // Settings & Content Script Bridge
  // ----------------------------------------------------
  async function loadSettings() {
    const config = await chrome.storage.local.get(["apiUrl", "apiKey"]);
    if (config.apiUrl) apiUrlInput.value = config.apiUrl;
    if (config.apiKey) apiKeyInput.value = config.apiKey;
  }

  btnSaveSettings.addEventListener("click", async () => {
    await chrome.storage.local.set({
      apiUrl: apiUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim()
    });
    settingsPanel.classList.add("hidden");
    appendLog("✅ Pengaturan API disimpan.");
  });

  function sendToContentScript(payload) {
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: "Content script timeout (halaman mungkin internal/terproteksi)" });
        }
      }, 5000);

      chrome.runtime.sendMessage(
        { action: "EXECUTE_IN_CONTENT", payload },
        (response) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response?.data || response || { success: false, error: "No response" });
            }
          }
        }
      );
    });
  }

  // ----------------------------------------------------
  // Core: Autonomous Multi-Step Agentic Loop (Nanobrowser & Agent-Browser Grade)
  // ----------------------------------------------------
  async function handleSend() {
    const userPrompt = promptInput.value.trim();
    if (!userPrompt || isAgentRunning) return;

    // 0. Cek Kuota Harian Gratis (Batas 40 request/hari jika tanpa custom API key)
    const stored = await chrome.storage.local.get(["apiUrl", "apiKey", "freeUsageDate", "freeUsageCount"]);
    const hasCustomKey = !!(stored.apiKey && stored.apiKey.trim());

    if (!hasCustomKey) {
      const today = new Date().toISOString().slice(0, 10);
      let currentUsage = (stored.freeUsageDate === today) ? (stored.freeUsageCount || 0) : 0;

      if (currentUsage >= 40) {
        addMessageToCurrentSession(
          "assistant",
          "⚠️ **Batas Kuota Gratis Tercapai (40/40 permintaan hari ini).**\n\nUntuk melanjutkan penggunaan tanpa batas, silakan masukkan API Key Anda di menu **⚙️ Pengaturan** di pojok kanan atas."
        );
        appendLog("Batas kuota harian gratis 40 permintaan telah tercapai.");
        return;
      }

      // Update counter
      await chrome.storage.local.set({
        freeUsageDate: today,
        freeUsageCount: currentUsage + 1
      });
      appendLog(`Penggunaan kuota gratis hari ini: ${currentUsage + 1}/40`);
    }

    promptInput.value = "";
    promptInput.style.height = "80px";
    shouldStopAgent = false;

    // Reset Anti-Loop Tracker di background worker setiap kali user mengirim perintah baru
    chrome.runtime.sendMessage({ action: "RESET_LOOP_TRACKER" }, () => {
      if (chrome.runtime.lastError) {}
    });

    addMessageToCurrentSession("user", userPrompt);
    setAgentRunning(true, "Memulai Agentic Loop...");
    showStatusIndicator("Memulai siklus otomatisasi...");
    appendLog(`User prompt: "${userPrompt}"`);

    const targetUrl = stored.apiUrl || "https://pesat-ai-chrome-agent.senna-947.workers.dev/";

    // Deteksi jika prompt adalah instruksi perangkuman halaman (Bypass AXTree DOM & kirim Readable Text murni)
    const isSummarize = /(?:rangkum|ringkas|summarize|ringkasan|rangkuman)/i.test(userPrompt);

    if (isSummarize) {
      try {
        setAgentRunning(true, "Merangkum artikel...");
        showStatusIndicator("Mengekstrak teks utama artikel...");
        appendLog("Mengambil konten teks utama (Readable Content) tanpa elemen UI/navigasi...");

        const textRes = await sendToContentScript({ type: "GET_READABLE_TEXT" });
        let cleanText = textRes?.text || "";
        let pageTitle = textRes?.title || "Halaman Web";
        let pageUrl = textRes?.url || "";

        // Fallback jika GET_READABLE_TEXT belum siap: coba scan DOM dan ambil pageContent
        if (!cleanText || cleanText.length < 20) {
          const scanFallback = await sendToContentScript({ type: "SCAN_DOM", showOverlay: false });
          cleanText = scanFallback?.data?.pageContent || "";
          pageTitle = scanFallback?.data?.title || pageTitle;
          pageUrl = scanFallback?.data?.url || pageUrl;
        }

        if (!cleanText || cleanText.length < 20) {
          addMessageToCurrentSession("assistant", "⚠️ Tidak ditemukan artikel atau teks utama yang memadai untuk dirangkum pada halaman ini. Pastikan halaman sudah termuat sempurna.");
          return;
        }

        const promptPayload = `[TEKS UTAMA ARTIKEL / HALAMAN WEB]
Judul: ${pageTitle}
URL: ${pageUrl}

${cleanText}

[INSTRUKSI PERANGKUMAN]
${userPrompt}`;

        showStatusIndicator("AI sedang menyusun ringkasan poin penting...");
        appendLog("Mengirimkan teks artikel ke AI Engine...");

        activeAbortController = new AbortController();
        const res = await fetch(targetUrl, {
          method: "POST",
          signal: activeAbortController.signal,
          headers: {
            "Content-Type": "application/json",
            ...(stored.apiKey ? { Authorization: `Bearer ${stored.apiKey}` } : {})
          },
          body: JSON.stringify({
            prompt: promptPayload,
            userQuery: userPrompt,
            isSummarize: true
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        if (data.success === false && data.error) {
          throw new Error(data.error);
        }

        const aiReply = data.reply || "Gagal menghasilkan rangkuman.";
        addMessageToCurrentSession("assistant", aiReply);
        appendLog("✅ Rangkuman berhasil dibuat.");
        return;
      } catch (err) {
        if (err.name === "AbortError" || shouldStopAgent) {
          appendLog("🛑 Perangkuman dibatalkan.");
        } else {
          appendLog(`Error perangkuman: ${err.message}`);
          addMessageToCurrentSession("assistant", `❌ Terjadi kesalahan saat merangkum: ${err.message}`);
        }
        return;
      } finally {
        setAgentRunning(false);
        hideStatusIndicator();
      }
    }

    const MAX_STEPS = 8;
    let stepCount = 0;
    let lastActionSuccess = true;
    let lastActionSummary = "";

    try {
      while (stepCount < MAX_STEPS && !shouldStopAgent) {
        stepCount++;
        setAgentRunning(true, `Langkah ${stepCount}/${MAX_STEPS}...`);
        appendLog(`─── Memulai Langkah ${stepCount} ───`);

        // 1. Scan DOM dari Tab Aktif (Semantic AXTree + Colored Bounding Boxes)
        showStatusIndicator(`Langkah ${stepCount}: Memindai elemen halaman...`);
        appendLog("Memindai elemen interaktif halaman...");
        const scanRes = await sendToContentScript({ type: "SCAN_DOM", showOverlay: true });

        let pageContext = "";
        if (scanRes && scanRes.success && scanRes.data) {
          const d = scanRes.data;
          if (stepCount === 1) {
            pageContext = `
[INFORMASI WEB AKTIF]
Judul: ${d.title}
URL: ${d.url}
Jumlah Elemen Interaktif: ${d.elementsCount}

[KONTEN TEKS LENGKAP HALAMAN (Untuk Rangkuman & Ekstraksi Data)]
${d.pageContent || "(Tidak ada konten teks utama)"}

[DAFTAR ELEMEN SEMANTIK AKSI TERTANDA [@eN]]
${d.reducedDOM || "(Tidak ada elemen interaktif)"}
            `.trim();
          } else {
            // Adaptive Token Diffing: Pada step 2+, skip full page text, fokus ke reduced semantic DOM
            pageContext = `
[INFORMASI WEB AKTIF (Step ${stepCount})]
Judul: ${d.title} | URL: ${d.url} | Elemen: ${d.elementsCount}

[DAFTAR ELEMEN SEMANTIK TERKINI [@eN]]
${d.reducedDOM || "(Tidak ada elemen interaktif)"}
            `.trim();
          }
          appendLog(`DOM terpindai: ${d.elementsCount} elemen.`);
        }

        if (shouldStopAgent) break;

        // 2. Susun prompt untuk LLM
        let promptPayload = `Konteks Halaman Web Terkini:\n${pageContext}\n\nTugas Utama Pengguna: "${userPrompt}"`;
        if (stepCount > 1) {
          promptPayload += `\n\nStatus Langkah Sebelumnya (${stepCount - 1}): ${lastActionSummary}`;
          promptPayload += `\nLanjutkan mengeksekusi langkah berikutnya yang diperlukan, atau kembalikan action "finish" jika seluruh tugas pengguna sudah selesai.`;
        }

        // Ambil riwayat chat terbaru
        const session = getCurrentSession();
        const history = (session?.messages || []).slice(-6).map(m => ({
          role: m.role,
          content: m.content
        }));

        showStatusIndicator(`Langkah ${stepCount}: AI sedang merencanakan aksi...`);
        appendLog(`Menghubungi AI Engine (Langkah ${stepCount})...`);
        setAgentRunning(true, `Berpikir (Langkah ${stepCount})...`);

        activeAbortController = new AbortController();
        const res = await fetch(targetUrl, {
          method: "POST",
          signal: activeAbortController.signal,
          headers: {
            "Content-Type": "application/json",
            ...(stored.apiKey ? { "Authorization": `Bearer ${stored.apiKey}` } : {})
          },
          body: JSON.stringify({
            prompt: promptPayload,
            userQuery: userPrompt,
            messages: history
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        if (data.success === false && data.error) {
          throw new Error(data.error);
        }

        const aiReply = data.reply || "";
        appendLog(`Respon AI (Langkah ${stepCount}) diterima.`);

        if (shouldStopAgent) break;

        // 3. Proses respons langkah ini
        const stepResult = await executeStepResponse(aiReply, stepCount, userPrompt);

        if (stepResult.isFinished) {
          appendLog("✅ Tugas selesai sepenuhnya (AI Finish).");
          break;
        }

        if (!stepResult.hasAction) {
          break;
        }

        if (!stepResult.actionSuccess) {
          lastActionSuccess = false;
          lastActionSummary = `Gagal mengeksekusi ${stepResult.actionType}: ${stepResult.errorMessage}`;
          appendLog(`⚠️ Langkah ${stepCount} gagal. Menghentikan loop untuk evaluasi.`);
          break;
        }

        lastActionSuccess = true;
        lastActionSummary = `Berhasil mengeksekusi ${stepResult.actionType} pada target [${stepResult.targetId || '—'}].`;

        // Jeda kecil sebelum langkah berikutnya agar halaman render state baru
        await new Promise(r => setTimeout(r, 600));
      }

      if (stepCount >= MAX_STEPS && !shouldStopAgent) {
        appendLog(`ℹ️ Batas maksimum ${MAX_STEPS} langkah tercapai.`);
      }

    } catch (err) {
      if (err.name === "AbortError" || shouldStopAgent) {
        appendLog("🛑 Permintaan dibatalkan.");
      } else {
        appendLog(`Error: ${err.message}`);
        addMessageToCurrentSession("assistant", `❌ Terjadi kesalahan: ${err.message}`);
      }
    } finally {
      setAgentRunning(false);
      hideStatusIndicator();
      await sendToContentScript({ type: "CLEAR_MARKERS" });
    }
  }

  // Natural Language Action Recovery Parser (Fallback jika LLM menjawab teks instruktif bukan JSON)
  function tryParseNaturalLanguageActions(text, userPrompt = "") {
    if (!text && !userPrompt) return null;
    const combined = `${text}\n${userPrompt}`;

    // 1. Deteksi Perintah Navigasi & Search
    const navRegex = /(?:buka|kunjungi|pergi ke|navigate to|open|go to)\s+(?:website|halaman|situs)?\s*[`"']?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s`"']*)?|https?:\/\/[^\s`"']+|cnn|youtube|google|wikipedia|github|twitter|facebook|instagram)[`"']?/i;
    const searchRegex = /(?:cari|search|googling|temukan)\s+(?:di google|di internet)?\s*[:=]?\s*[`"']?([^`"'\n]+)[`"']?/i;

    const navMatch = combined.match(navRegex);
    if (navMatch) {
      let dest = navMatch[1].trim();
      if (!dest.includes(".") && !dest.startsWith("http")) {
        dest = dest + ".com";
      }
      if (!/^https?:\/\//i.test(dest)) dest = "https://" + dest;

      return {
        planner: { steps: [`1. Membuka alamat website ${dest}`, "2. Menunggu halaman termuat sempurna"] },
        action: "navigate",
        value: dest,
        url: dest,
        message: `Membuka website ${dest}...`
      };
    }

    const searchMatch = combined.match(searchRegex);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      const dest = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      return {
        planner: { steps: [`1. Mencari "${query}" di Google`, "2. Menunggu hasil pencarian"] },
        action: "navigate",
        value: dest,
        url: dest,
        message: `Mencari "${query}" di Google...`
      };
    }

    const lines = text.split('\n');
    const actions = [];

    // e.g.: Ketik `admin@jetdigitalpro.com` pada [@e1].
    // e.g.: Ketik jdp123 pada [@e2].
    // e.g.: Klik tombol Sign In [@e3].
    const typeRegex = /(?:ketik|isi|tulis|masukkan|type|fill)\s+[`"']?([^`"'\n]+?)[`"']?\s+(?:pada|di|ke|into|in)\s+\[?(@e\d+|#\d+|\d+)\]?/i;
    const clickRegex = /(?:klik|tekan|pilih|click|press)\s+(?:tombol|button|link|menu)?\s*[`"']?([^`"'\n]+?)?[`"']?\s*(?:pada|di|ke)?\s*\[?(@e\d+|#\d+|\d+)\]?/i;

    for (const line of lines) {
      const tMatch = line.match(typeRegex);
      if (tMatch) {
        const rawId = tMatch[2];
        const normId = rawId.startsWith("@e") ? rawId : `@e${rawId.replace(/[^0-9]/g, '')}`;
        actions.push({
          action: "type",
          value: tMatch[1].trim(),
          elementId: normId
        });
        continue;
      }
      const cMatch = line.match(clickRegex);
      if (cMatch) {
        const rawId = cMatch[2];
        const normId = rawId.startsWith("@e") ? rawId : `@e${rawId.replace(/[^0-9]/g, '')}`;
        actions.push({
          action: "click",
          elementId: normId,
          message: cMatch[1] ? `Klik ${cMatch[1].trim()}` : undefined
        });
      }
    }

    if (actions.length > 0) {
      return {
        planner: { steps: actions.map((a, i) => `${i + 1}. ${a.action === 'type' ? `Isi "${a.value}"` : 'Klik'} pada [${a.elementId}]`) },
        actions: actions,
        message: `Mengeksekusi ${actions.length} aksi otomatis yang teridentifikasi.`
      };
    }
    return null;
  }

  // Menjalankan satu langkah Multi-Agent response
  async function executeStepResponse(rawReply, stepNum, userPrompt = "") {
    let resObj = null;
    const jsonMatch = rawReply.match(/```json\s*([\s\S]*?)\s*```/) || rawReply.match(/\{[\s\S]*"action"[\s\S]*\}/) || rawReply.match(/\{[\s\S]*"actions"[\s\S]*\}/) || rawReply.match(/\{[\s\S]*"planner"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        resObj = JSON.parse(jsonStr);
      } catch (e) {
        console.error("[Pesat] JSON parse error:", e);
      }
    }

    // Jika JSON tidak ditemukan atau aksi tidak terdefinisi, coba pulihkan dari teks instruksi alami
    if (!resObj || (!resObj.action && !resObj.actions && !resObj.message)) {
      resObj = tryParseNaturalLanguageActions(rawReply, userPrompt);
    }

    if (resObj) {
      try {
        const isBatch = Array.isArray(resObj.actions) && resObj.actions.length > 0;
        let actionType = isBatch ? "batch" : (resObj.action || resObj.navigator?.action);
        const targetId = resObj.elementId || resObj.navigator?.elementId || (isBatch ? resObj.actions.map(a => a.elementId || a.target).join(", ") : "");
        let actionValue = resObj.value || resObj.url || resObj.target || resObj.navigator?.value || resObj.navigator?.url;

        // Human-in-the-Loop: Handler jika AI memanggil tool 'ask_user'
        if (actionType === "ask_user" || resObj.question) {
          const askQuestion = resObj.question || resObj.message || "Terdapat beberapa kemungkinan tindakan. Silakan pilih salah satu:";
          const askOptions = Array.isArray(resObj.options) && resObj.options.length > 0
            ? resObj.options
            : ["Buka Website", "Cari di Halaman Ini", "Rangkum Informasi"];

          addMessageToCurrentSession("assistant", askQuestion, null, {
            question: askQuestion,
            options: askOptions
          });
          appendLog(`🤔 AI meminta klarifikasi pengguna: "${askQuestion}"`);
          return { isFinished: true, hasAction: false };
        }

        // Normalisasi nama aksi navigasi
        if (actionType === "navigate_to") {
          actionType = "navigate";
        }

        // Normalisasi aksi search menjadi navigate Google
        if (actionType === "search" || actionType === "google") {
          actionType = "navigate";
          actionValue = `https://www.google.com/search?q=${encodeURIComponent(actionValue || userPrompt)}`;
        }

        // Recovery jika actionType navigate tapi actionValue kosong / undefined
        if (actionType === "navigate" && (!actionValue || typeof actionValue !== "string" || !actionValue.trim() || actionValue === "undefined")) {
          const navInText = (resObj.message || userPrompt || "").match(/(?:https?:\/\/[^\s`"']+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s`"']*)?|cnn|youtube|google|wikipedia|github)/i);
          if (navInText) {
            let dest = navInText[0].trim();
            if (!dest.includes(".") && !dest.startsWith("http")) dest = dest + ".com";
            actionValue = /^https?:\/\//i.test(dest) ? dest : `https://${dest}`;
          } else {
            actionValue = `https://www.google.com/search?q=${encodeURIComponent(userPrompt)}`;
          }
        }

        // Jika AI memanggil finish_task atau finish
        if (actionType === "finish_task" || actionType === "finish" || (!actionType && !isBatch && resObj.message)) {
          const finalMsg = resObj.message || resObj.answer || "Tugas telah selesai dikerjakan!";
          addMessageToCurrentSession("assistant", finalMsg);
          appendLog(`✅ AI memanggil finish_task: ${finalMsg}`);
          return { isFinished: true, hasAction: false };
        }

        const multiAgentData = {
          planner: resObj.planner || (resObj.thought ? { steps: [resObj.thought] } : null),
          navigator: {
            action: isBatch ? `Batch (${resObj.actions.length} aksi)` : actionType,
            elementId: targetId,
            description: resObj.message || (isBatch ? `Mengeksekusi ${resObj.actions.length} langkah berurutan` : `Mengeksekusi ${actionType} ${actionType === 'navigate' ? actionValue : `pada [${targetId || ''}]`}`),
            status: "Sedang berjalan..."
          },
          validator: null,
          finalAnswer: resObj.answer || ""
        };

        const statusLabel = isBatch ? `Mengeksekusi: Batch (${resObj.actions.length} aksi)...` : `Mengeksekusi: ${actionType} ${actionType === 'navigate' ? actionValue : `[${targetId || '—'}]`}...`;
        showStatusIndicator(statusLabel);
        setAgentRunning(true, `Aksi: ${isBatch ? `Batch (${resObj.actions.length})` : `${actionType} [${targetId || '—'}]`}`);
        appendLog(`▶ Menjalankan [Step ${stepNum}]: ${isBatch ? `Batch (${resObj.actions.length} aksi)` : `${actionType} ${actionType === 'navigate' ? actionValue : `[${targetId || '—'}]`}`}`);

        let execResult;
        if (actionType === "navigate") {
          execResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { action: "NAVIGATE_TAB", url: actionValue },
              (response) => {
                if (chrome.runtime.lastError) {
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  resolve(response || { success: true, url: actionValue });
                }
              }
            );
          });
        } else if (isBatch) {
          const normalizedActions = resObj.actions.map(act => ({
            ...act,
            elementId: act.elementId || act.target
          }));
          execResult = await sendToContentScript({
            type: "EXECUTE_ACTION",
            actionData: {
              actions: normalizedActions
            }
          });
        } else {
          execResult = await sendToContentScript({
            type: "EXECUTE_ACTION",
            actionData: {
              action: actionType,
              elementId: targetId,
              value: actionValue,
              pressEnter: resObj.pressEnter
            }
          });
        }

        // Auto-wait setelah aksi
        if (execResult && execResult.success) {
          const needsWait = actionType === "navigate" || actionType === "click" || isBatch;
          if (needsWait) {
            const waitMs = actionType === "navigate" ? 3500 : 1200;
            showStatusIndicator(`Menunggu halaman stabil (maks ${waitMs / 1000}s)...`);
            appendLog(`⏳ Menunggu halaman dimuat (maks ${waitMs / 1000}s)...`);
            setAgentRunning(true, "Menunggu halaman...");

            await new Promise(r => setTimeout(r, actionType === "navigate" ? 1500 : 300));

            const stableResult = await sendToContentScript({
              type: "WAIT_FOR_DOM_STABLE",
              maxWaitMs: waitMs,
              stableWindowMs: actionType === "navigate" ? 700 : 500
            });

            if (stableResult?.stable || stableResult?.timedOut) {
              appendLog(`✅ Halaman stabil${stableResult.timedOut ? " (lanjut paksa)" : ""}.`);
            }
          }

          const elapsed = actionType === "navigate" ? "3.5s" : "1.2s";
          multiAgentData.navigator.status = `Selesai (${elapsed})`;
          multiAgentData.validator = {
            success: true,
            message: execResult.message || `Aksi ${actionType} ${actionType === 'navigate' ? `ke ${actionValue}` : `pada [${targetId || '—'}]`} berhasil.`
          };

          addMessageToCurrentSession("assistant", "", multiAgentData);

          // Cek apakah perintah hanya membuka website
          const isOnlyNavigate = actionType === "navigate" && /^(buka|open|go to|pergi ke|kunjungi|cari|search)\s+[a-zA-Z0-9.-]+/i.test(userPrompt.trim());

          if (isOnlyNavigate) {
            appendLog(`✅ Navigasi ke ${actionValue} selesai. Tugas utama tuntas.`);
            return {
              isFinished: true,
              hasAction: true,
              actionSuccess: true,
              actionType,
              targetId
            };
          }

          // Cek apakah perintah pengetikan pencarian dengan pressEnter sudah tuntas
          const isSearchTypeSubmitted = (actionType === "type" || actionType === "type_text") && resObj.pressEnter;
          if (isSearchTypeSubmitted) {
            appendLog(`✅ Pengetikan dan pengiriman formulir pencarian selesai.`);
            return {
              isFinished: true,
              hasAction: true,
              actionSuccess: true,
              actionType,
              targetId
            };
          }

          return {
            isFinished: false,
            hasAction: true,
            actionSuccess: true,
            actionType,
            targetId
          };
        } else {
          // Aksi gagal atau Circuit Breaker Loop Terdeteksi
          multiAgentData.navigator.status = "Gagal";

          if (execResult?.isLoopDetected) {
            multiAgentData.validator = {
              success: false,
              message: `🛑 ${execResult.error}`
            };
            appendLog(`🛑 Circuit Breaker: ${execResult.error}`);
            addMessageToCurrentSession("assistant", "", multiAgentData);
            return {
              isFinished: true,
              hasAction: false,
              actionSuccess: false,
              actionType,
              targetId
            };
          }

          const suggestion = execResult?.suggestion === "scroll"
            ? "💡 Coba gulir halaman ke bawah terlebih dahulu."
            : "💡 Coba muat ulang halaman, lalu ulangi perintah.";
          multiAgentData.validator = {
            success: false,
            message: `${execResult?.error || "Terjadi kesalahan saat eksekusi."}\n\n${suggestion}`
          };
          appendLog(`❌ Aksi gagal: ${execResult?.error}`);

          addMessageToCurrentSession("assistant", "", multiAgentData);

          return {
            isFinished: false,
            hasAction: true,
            actionSuccess: false,
            actionType,
            targetId,
            errorMessage: execResult?.error
          };
        }

      } catch (e) {
        console.error("[Pesat] Step execution error:", e);
      }
    }

    // Tampilkan balasan teks biasa
    addMessageToCurrentSession("assistant", rawReply);
    return { isFinished: true, hasAction: false };
  }

  // ----------------------------------------------------
  // 3. Prompt Chip Button Interaction (Auto-fill & Focus)
  // ----------------------------------------------------
  function applyPromptToInput(text) {
    promptInput.value = text;
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(Math.max(promptInput.scrollHeight, 80), 180) + "px";
    promptInput.focus();
  }

  chipSummarize.addEventListener("click", () => {
    applyPromptToInput("Tolong berikan ringkasan poin-poin utama dari isi konten halaman web ini dalam format Markdown yang rapi dengan bullet points.");
    handleSend();
  });

  chipExtract.addEventListener("click", () => {
    applyPromptToInput("Tolong ekstrak data atau tabel penting yang ada pada halaman ini dan sajikan dalam format tabel Markdown.");
    handleSend();
  });

  chipAutoFill.addEventListener("click", () => {
    applyPromptToInput("Tolong periksa kolom input atau formulir pada halaman ini, lalu pandu saya cara mengisinya dengan bahasa yang ramah dan mudah dipahami.");
    handleSend();
  });

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

  // Auto resize textarea on typing
  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(Math.max(promptInput.scrollHeight, 80), 180) + "px";
  });

  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // ----------------------------------------------------
  // Helpers
  // ----------------------------------------------------
  function setAgentRunning(running, statusText = "Siap") {
    isAgentRunning = running;
    agentStatus.textContent = statusText;
    if (running) {
      agentStatus.classList.add("working");
      stopBar.classList.remove("hidden");
    } else {
      agentStatus.classList.remove("working");
      stopBar.classList.add("hidden");
    }
  }

  btnStopAgent.addEventListener("click", () => {
    shouldStopAgent = true;
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch (e) {}
      activeAbortController = null;
    }
    setAgentRunning(false, "Dihentikan");
    hideStatusIndicator();
    appendLog("🛑 Otomatisasi dihentikan oleh pengguna.");
  });

  function appendLog(logText, level = "INFO", details = null, type = "EVENT") {
    // 1. Kirim telemetri silent ke Cloudflare Pages / Workers
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

    // 2. Jika elemen logContent ada (opsional), append secara aman
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

  // Event Listeners Header & Drawers
  btnNewChat.addEventListener("click", createNewSession);
  btnDrawerNewChat.addEventListener("click", createNewSession);

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
  });
  btnCloseSettings.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
  });
  btnCancelSettings.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
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

  btnSend.addEventListener("click", handleSend);
});
