// sidepanel.js - Pesat AI Browser Agent (Multi-Agent Pipeline, Rich Markdown, & Full History)

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

  // Initialize
  await loadSettings();
  await loadSessions();

  // ----------------------------------------------------
  // Markdown & Rich Text Formatter
  // ----------------------------------------------------
  function parseMarkdown(text) {
    if (!text) return "";
    
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
    html = html.replace(/<\/ul>\s*<ul>/g, ''); // merge lists

    // Markdown Tables (Rich responsive table parser)
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
            tableHtml += '<div class="table-responsive"><table>';
          }
          if (line.includes('---') || line.includes(':---') || line.includes('---:')) {
            isFirstRow = false;
            continue; // skip separator row
          }
          
          const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          const tag = isFirstRow ? 'th' : 'td';
          tableHtml += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
          if (isFirstRow) isFirstRow = false;
        } else {
          if (inTable) {
            inTable = false;
            tableHtml += '</table></div>';
          }
          tableHtml += (line ? line + '<br>' : '<br>');
        }
      }
      if (inTable) tableHtml += '</table></div>';
      html = tableHtml;
    } else {
      // Newlines to br (outside of pre/ul)
      html = html.replace(/\n/g, '<br>');
    }

    return html;
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
    await chrome.storage.local.set({
      agent_sessions: sessions,
      current_session_id: currentSessionId
    });
    renderSessionList();
  }

  function createNewSession() {
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
        <div class="message-bubble">
          <strong>Halo! Saya Pesat AI Agent ⚡</strong><br>
          Asisten browser otonom dengan kolaborasi multi-agent (Planner, Navigator, & Validator).
          <div class="welcome-suggestions">
            <span class="suggestion-tag" data-prompt="Apa isi ringkasan dari halaman web ini?">💡 Rangkum web ini</span>
            <span class="suggestion-tag" data-prompt="Cari kolom pencarian dan ketik query">🔍 Cari sesuatu</span>
            <span class="suggestion-tag" data-prompt="Tolong ekstrak data tabel pada halaman ini">📊 Ekstrak tabel</span>
          </div>
        </div>
      </div>
    `;
    attachSuggestionListeners();
  }

  function attachSuggestionListeners() {
    document.querySelectorAll(".suggestion-tag").forEach(tag => {
      tag.addEventListener("click", () => {
        const prompt = tag.getAttribute("data-prompt");
        if (prompt) {
          promptInput.value = prompt;
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
              ${navigator.elementId ? `<span class="target-badge">Target: [${navigator.elementId}]</span>` : ''}
              ${navigator.status ? `<div style="font-size:10px; color:#93c5fd; margin-top:3px;">Status: ${escapeHtml(navigator.status)}</div>` : ''}
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
      btnEdit.addEventListener("click", () => editPromptAt(index));
    }

    chatArea.appendChild(msgDiv);
  }

  function editPromptAt(index) {
    const session = getCurrentSession();
    if (!session || !session.messages[index]) return;

    const originalText = session.messages[index].content;
    promptInput.value = originalText;
    promptInput.focus();

    session.messages = session.messages.slice(0, index);
    saveSessions();
    renderCurrentSession();
    appendLog(`Prompt ke-${index + 1} dimuat kembali untuk diedit.`);
  }

  function addMessageToCurrentSession(role, content, multiAgent = null) {
    const session = getCurrentSession();
    if (!session) return;

    const msgObj = { role, content, timestamp: Date.now(), multiAgent };
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
      chrome.runtime.sendMessage(
        { action: "EXECUTE_IN_CONTENT", payload },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response?.data || response || { success: false, error: "No response" });
          }
        }
      );
    });
  }

  // ----------------------------------------------------
  // Core: Autonomous AI Action & Prompt Dispatch
  // ----------------------------------------------------
  // ----------------------------------------------------
  // Core: Autonomous Multi-Step Agentic Loop (Nanobrowser-Grade)
  // ----------------------------------------------------
  async function handleSend() {
    const userPrompt = promptInput.value.trim();
    if (!userPrompt || isAgentRunning) return;

    promptInput.value = "";
    promptInput.style.height = "36px";
    shouldStopAgent = false;

    addMessageToCurrentSession("user", userPrompt);
    setAgentRunning(true, "Memulai Agentic Loop...");
    appendLog(`User prompt: "${userPrompt}"`);

    const stored = await chrome.storage.local.get(["apiUrl", "apiKey"]);
    const targetUrl = stored.apiUrl || "https://pesat-ai-chrome-agent.senna-947.workers.dev/";

    const MAX_STEPS = 8;
    let stepCount = 0;
    let lastActionSuccess = true;
    let lastActionSummary = "";

    try {
      while (stepCount < MAX_STEPS && !shouldStopAgent) {
        stepCount++;
        setAgentRunning(true, `Langkah ${stepCount}/${MAX_STEPS}...`);
        appendLog(`─── Memulai Langkah ${stepCount} ───`);

        // 1. Scan DOM dari Tab Aktif (Colored Bounding Boxes)
        appendLog("Memindai elemen interaktif halaman...");
        const scanRes = await sendToContentScript({ type: "SCAN_DOM", showOverlay: true });
        
        let pageContext = "";
        if (scanRes && scanRes.success && scanRes.data) {
          const d = scanRes.data;
          pageContext = `
[INFORMASI WEB AKTIF]
Judul: ${d.title}
URL: ${d.url}
Jumlah Elemen Interaktif: ${d.elementsCount}

[KONTEN TEKS LENGKAP HALAMAN (Untuk Rangkuman & Ekstraksi Data)]
${d.pageContent || "(Tidak ada konten teks utama)"}

[DAFTAR ELEMEN INTERAKTIF VIEWPORT BERNOMOR (Untuk Navigasi/Aksi)]
${d.reducedDOM || "(Tidak ada elemen interaktif)"}
          `.trim();
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

        appendLog(`Menghubungi AI Engine (Langkah ${stepCount})...`);
        setAgentRunning(true, `Berpikir (Langkah ${stepCount})...`);

        const res = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(stored.apiKey ? { "Authorization": `Bearer ${stored.apiKey}` } : {})
          },
          body: JSON.stringify({
            prompt: promptPayload,
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
        const stepResult = await executeStepResponse(aiReply, stepCount);

        if (stepResult.isFinished) {
          appendLog("✅ Tugas selesai sepenuhnya (AI Finish).");
          break;
        }

        if (!stepResult.hasAction) {
          // Hanya balasan percakapan / teks biasa, tidak ada aksi fisik lanjutan
          break;
        }

        if (!stepResult.actionSuccess) {
          // Aksi gagal
          lastActionSuccess = false;
          lastActionSummary = `Gagal mengeksekusi ${stepResult.actionType}: ${stepResult.errorMessage}`;
          appendLog(`⚠️ Langkah ${stepCount} gagal. Menghentikan loop untuk evaluasi.`);
          break;
        }

        lastActionSuccess = true;
        lastActionSummary = `Berhasil mengeksekusi ${stepResult.actionType} pada target [${stepResult.targetId || '—'}].`;

        // Jeda kecil sebelum langkah berikutnya agar halaman sempat render state baru
        await new Promise(r => setTimeout(r, 600));
      }

      if (stepCount >= MAX_STEPS && !shouldStopAgent) {
        appendLog(`ℹ️ Batas maksimum ${MAX_STEPS} langkah tercapai.`);
      }

    } catch (err) {
      appendLog(`Error: ${err.message}`);
      addMessageToCurrentSession("assistant", `❌ Terjadi kesalahan: ${err.message}`);
    } finally {
      setAgentRunning(false);
      // Bersihkan marker jika selesai
      await sendToContentScript({ type: "CLEAR_MARKERS" });
    }
  }

  // Menjalankan satu langkah Multi-Agent response
  async function executeStepResponse(rawReply, stepNum) {
    const jsonMatch = rawReply.match(/```json\s*([\s\S]*?)\s*```/) || rawReply.match(/\{[\s\S]*"action"[\s\S]*\}/) || rawReply.match(/\{[\s\S]*"planner"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const resObj = JSON.parse(jsonStr);

        const actionType = resObj.action || resObj.navigator?.action;
        const targetId = resObj.elementId || resObj.navigator?.elementId;
        const actionValue = resObj.value || resObj.navigator?.value;

        // Jika AI memutuskan tugas selesai
        if (actionType === "finish" || (!actionType && resObj.message)) {
          const finalMsg = resObj.message || resObj.answer || "Tugas telah selesai dikerjakan!";
          addMessageToCurrentSession("assistant", finalMsg);
          return { isFinished: true, hasAction: false };
        }

        const multiAgentData = {
          planner: resObj.planner || (resObj.thought ? { steps: [resObj.thought] } : null),
          navigator: {
            action: actionType,
            elementId: targetId,
            description: resObj.message || `Mengeksekusi ${actionType} pada elemen [${targetId || ''}]`,
            status: "Sedang berjalan..."
          },
          validator: null,
          finalAnswer: resObj.answer || ""
        };

        setAgentRunning(true, `Aksi: ${actionType} [${targetId || '—'}]`);
        appendLog(`▶ Menjalankan [Step ${stepNum}]: ${actionType} ${actionType === 'navigate' ? actionValue : `[${targetId || '—'}]`}`);

        let execResult;
        if (actionType === "navigate") {
          execResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { action: "NAVIGATE_TAB", url: actionValue },
              (response) => {
                if (chrome.runtime.lastError) {
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  resolve(response || { success: true });
                }
              }
            );
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
          const needsWait = actionType === "navigate" || actionType === "click";
          if (needsWait) {
            const waitMs = actionType === "navigate" ? 3500 : 1200;
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
            message: `Aksi ${actionType} ${actionType === 'navigate' ? `menuju ${actionValue}` : `pada [${targetId || '—'}]`} berhasil.`
          };

          addMessageToCurrentSession("assistant", "", multiAgentData);

          return {
            isFinished: false,
            hasAction: true,
            actionSuccess: true,
            actionType,
            targetId
          };
        } else {
          // Aksi gagal
          multiAgentData.navigator.status = "Gagal";
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
        console.error("[Pesat] JSON parse error:", e);
      }
    }

    // Tampilkan balasan teks biasa
    addMessageToCurrentSession("assistant", rawReply);
    return { isFinished: true, hasAction: false };
  }



  // ----------------------------------------------------
  // Quick Action Chips Handlers
  // ----------------------------------------------------
  chipSummarize.addEventListener("click", () => {
    promptInput.value = "Tolong berikan ringkasan poin-poin utama dari isi konten halaman web ini dalam format Markdown yang rapi dengan bullet points.";
    handleSend();
  });

  chipExtract.addEventListener("click", () => {
    promptInput.value = "Tolong ekstrak data atau tabel penting yang ada pada halaman ini dan sajikan dalam format tabel Markdown.";
    handleSend();
  });

  chipAutoFill.addEventListener("click", () => {
    promptInput.value = "Tolong periksa kolom input atau formulir pada halaman ini, lalu pandu saya cara mengisinya dengan bahasa yang ramah dan mudah dipahami (hindari istilah koding mentah).";
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
    setAgentRunning(false, "Dihentikan");
    appendLog("🛑 Otomatisasi dihentikan oleh pengguna.");
  });

  function appendLog(logText) {
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

  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Event Listeners
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

  logToggle.addEventListener("click", () => {
    const isHidden = logContent.classList.toggle("hidden");
    logIcon.textContent = isHidden ? "▼" : "▲";
  });

  btnSend.addEventListener("click", handleSend);
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 90) + "px";
  });
});
