// sidepanel.js - Pesat AI Browser Agent Main Logic (History, Edit Prompt, Autonomous Actions)

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
  let sessions = []; // Array of session objects: { id, title, timestamp, messages: [] }
  let isAgentRunning = false;
  let shouldStopAgent = false;
  let markersVisible = false;

  // Initialize Settings & Sessions
  await loadSettings();
  await loadSessions();

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
          Saya dapat membaca halaman web aktif, mengklik tombol, mengisi form, atau merangkum data untuk Anda.
          <div class="welcome-suggestions">
            <span class="suggestion-tag" data-prompt="Apa isi ringkasan dari halaman web ini?">💡 Rangkum web ini</span>
            <span class="suggestion-tag" data-prompt="Cari informasi kontak atau email di halaman ini">🔍 Cari kontak</span>
            <span class="suggestion-tag" data-prompt="Tolong cari tombol pencarian dan ketik query">🎯 Cari sesuatu</span>
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
  // Message Rendering & Edit Prompt Feature
  // ----------------------------------------------------
  function renderMessageBubble(msg, index) {
    const isUser = msg.role === "user";
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${isUser ? "user-message" : "assistant-message"}`;
    msgDiv.dataset.index = index;

    let contentHtml = escapeHtml(msg.content).replace(/\n/g, "<br>");

    // Jika pesan memiliki info step aksi
    if (msg.stepCard) {
      contentHtml += `
        <div class="step-card ${msg.stepCard.type || 'action'}">
          ${msg.stepCard.icon || '⚡'} ${escapeHtml(msg.stepCard.text)}
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="message-bubble">
        ${contentHtml}
      </div>
      ${isUser ? `
        <div class="message-actions">
          <button class="action-icon-btn btn-edit-prompt" title="Edit prompt & jalankan ulang">✏️ Edit</button>
        </div>
      ` : ''}
    `;

    // Pasang event edit prompt
    if (isUser) {
      const btnEdit = msgDiv.querySelector(".btn-edit-prompt");
      btnEdit.addEventListener("click", () => {
        editPromptAt(index);
      });
    }

    chatArea.appendChild(msgDiv);
  }

  // Edit Prompt & Re-run Logic (Branching)
  function editPromptAt(index) {
    const session = getCurrentSession();
    if (!session || !session.messages[index]) return;

    const originalText = session.messages[index].content;
    promptInput.value = originalText;
    promptInput.focus();

    // Potong percakapan di titik pesan ini (buang pesan setelahnya)
    session.messages = session.messages.slice(0, index);
    saveSessions();
    renderCurrentSession();
    appendLog(`Prompt ke-${index + 1} dimuat kembali untuk diedit.`);
  }

  function addMessageToCurrentSession(role, content, stepCard = null) {
    const session = getCurrentSession();
    if (!session) return;

    const msgObj = { role, content, timestamp: Date.now(), stepCard };
    session.messages.push(msgObj);

    // Auto update session title dari prompt pertama
    if (session.messages.length === 1 && role === "user") {
      session.title = content.substring(0, 32) + (content.length > 32 ? "..." : "");
    }

    session.timestamp = Date.now();
    saveSessions();
    renderMessageBubble(msgObj, session.messages.length - 1);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // ----------------------------------------------------
  // Settings Logic
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

  // ----------------------------------------------------
  // Content Script Messenger Helper
  // ----------------------------------------------------
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
  async function handleSend() {
    const userPrompt = promptInput.value.trim();
    if (!userPrompt || isAgentRunning) return;

    // Bersihkan input
    promptInput.value = "";
    promptInput.style.height = "36px";

    // Simpan pesan user
    addMessageToCurrentSession("user", userPrompt);

    setAgentRunning(true, "Menganalisis Halaman...");
    appendLog(`User prompt: "${userPrompt}"`);

    // 1. Scan DOM dari Halaman Aktif secara otomatis
    appendLog("Memindai DOM halaman aktif...");
    const scanRes = await sendToContentScript({ type: "SCAN_DOM", showOverlay: true });
    
    let pageContext = "";
    if (scanRes && scanRes.success && scanRes.data) {
      const d = scanRes.data;
      pageContext = `
[INFORMASI WEB AKTIF]
Judul: ${d.title}
URL: ${d.url}
Jumlah Elemen Interaktif: ${d.elementsCount}

[DAFTAR ELEMEN INTERAKTIF VIEWPORT]
${d.reducedDOM || "(Tidak ada elemen interaktif terdeteksi)"}
      `.trim();
      appendLog(`DOM terpindai: ${d.elementsCount} elemen.`);
    } else {
      appendLog(`Peringatan: Gagal memindai DOM (${scanRes?.error || "Tab tidak didukung"}).`);
    }

    // 2. Hubungi Backend AI Proxy
    const stored = await chrome.storage.local.get(["apiUrl", "apiKey"]);
    const targetUrl = stored.apiUrl || "https://pesat-ai-chrome-agent.senna-947.workers.dev/";

    try {
      appendLog(`Menghubungi AI Engine: ${targetUrl}`);
      setAgentRunning(true, "Berpikir...");

      const session = getCurrentSession();
      const history = (session?.messages || []).slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(stored.apiKey ? { "Authorization": `Bearer ${stored.apiKey}` } : {})
        },
        body: JSON.stringify({
          prompt: `Konteks Halaman Web:\n${pageContext}\n\nPermintaan Pengguna: ${userPrompt}`,
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
      appendLog("Respon AI diterima.");

      // 3. Cek apakah respon berupa JSON Action (Otomatisasi) atau Teks Percakapan
      await processAiResponse(aiReply);

    } catch (err) {
      appendLog(`Error: ${err.message}`);
      addMessageToCurrentSession("assistant", `❌ Terjadi kesalahan: ${err.message}`);
    } finally {
      setAgentRunning(false);
    }
  }

  // Memproses respon AI (Parsing JSON Action vs Chat Markdown)
  async function processAiResponse(rawReply) {
    // Cek jika AI mengembalikan blok JSON Action
    const jsonMatch = rawReply.match(/```json\s*([\s\S]*?)\s*```/) || rawReply.match(/\{[\s\S]*"action"[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const actionObj = JSON.parse(jsonStr);

        // Tampilkan pemikiran AI (Thought)
        if (actionObj.thought) {
          addMessageToCurrentSession("assistant", actionObj.thought, {
            type: "thought",
            icon: "🧠",
            text: `Pemikiran Agent: ${actionObj.thought}`
          });
        }

        // Eksekusi aksi fisik pada halaman web
        if (actionObj.action && actionObj.action !== "finish") {
          setAgentRunning(true, `Aksi: ${actionObj.action} [${actionObj.elementId || ''}]`);
          appendLog(`Mengeksekusi aksi: ${actionObj.action} pada element [${actionObj.elementId}]`);

          const execResult = await sendToContentScript({
            type: "EXECUTE_ACTION",
            actionData: actionObj
          });

          if (execResult.success) {
            addMessageToCurrentSession("assistant", actionObj.message || `✅ Berhasil mengeksekusi ${actionObj.action}.`, {
              type: "action",
              icon: "🎯",
              text: `Aksi Selesai: ${execResult.message || 'Sukses'}`
            });
          } else {
            addMessageToCurrentSession("assistant", `⚠️ Gagal eksekusi: ${execResult.error}`, {
              type: "error",
              icon: "❌",
              text: execResult.error
            });
          }
        } else {
          // Action finish / jawaban akhir
          addMessageToCurrentSession("assistant", actionObj.message || actionObj.answer || rawReply);
        }
        return;
      } catch (e) {
        // Fallback jika bukan valid JSON
      }
    }

    // Tampilkan balasan teks biasa
    addMessageToCurrentSession("assistant", rawReply);
  }

  // ----------------------------------------------------
  // Quick Action Chips Handlers
  // ----------------------------------------------------
  chipSummarize.addEventListener("click", async () => {
    promptInput.value = "Tolong berikan ringkasan poin-poin utama dari isi konten halaman web ini dalam format yang rapi.";
    handleSend();
  });

  chipExtract.addEventListener("click", async () => {
    promptInput.value = "Tolong ekstrak data atau tabel penting yang ada pada halaman ini dan sajikan dalam format tabel Markdown.";
    handleSend();
  });

  chipAutoFill.addEventListener("click", async () => {
    promptInput.value = "Tolong periksa apakah ada formulir pada halaman ini dan bantu saya mengisinya.";
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
  // UI Helpers & Event Listeners
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

  // Header & Drawer Triggers
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

  // Auto-resize textarea
  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 90) + "px";
  });
});
