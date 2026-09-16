// sidepanel.js - Main logic for Agent Side Panel

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const chatArea = document.getElementById("chatArea");
  const promptInput = document.getElementById("promptInput");
  const btnSend = document.getElementById("btnSend");
  const btnInspectPage = document.getElementById("btnInspectPage");
  const btnHighlightDOM = document.getElementById("btnHighlightDOM");
  const agentStatus = document.getElementById("agentStatus");
  const logToggle = document.getElementById("logToggle");
  const logContent = document.getElementById("logContent");
  const logIcon = document.getElementById("logIcon");
  
  // Settings elements
  const btnSettings = document.getElementById("btnSettings");
  const settingsPanel = document.getElementById("settingsPanel");
  const apiUrlInput = document.getElementById("apiUrlInput");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const btnSaveSettings = document.getElementById("btnSaveSettings");
  const btnCancelSettings = document.getElementById("btnCancelSettings");

  // Load saved settings
  const config = await chrome.storage.local.get(["apiUrl", "apiKey"]);
  if (config.apiUrl) apiUrlInput.value = config.apiUrl;
  if (config.apiKey) apiKeyInput.value = config.apiKey;

  // Toggle Settings Panel
  btnSettings.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });

  btnCancelSettings.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
  });

  btnSaveSettings.addEventListener("click", async () => {
    await chrome.storage.local.set({
      apiUrl: apiUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim()
    });
    settingsPanel.classList.add("hidden");
    appendLog("✅ Pengaturan API berhasil disimpan.");
  });

  // Toggle Log Accordion
  logToggle.addEventListener("click", () => {
    const isHidden = logContent.classList.toggle("hidden");
    logIcon.textContent = isHidden ? "▼" : "▲";
  });

  // Function to Append Message to Chat
  function appendMessage(text, isUser = false) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${isUser ? "user-message" : "assistant-message"}`;
    
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.innerHTML = text.replace(/\n/g, "<br>");
    
    msgDiv.appendChild(contentDiv);
    chatArea.appendChild(msgDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // Function to Append Log
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

  // Set Agent Status
  function setStatus(statusText, isWorking = false) {
    agentStatus.textContent = statusText;
    if (isWorking) {
      agentStatus.classList.add("working");
    } else {
      agentStatus.classList.remove("working");
    }
  }

  // Quick Action: Inspect Page
  btnInspectPage.addEventListener("click", () => {
    setStatus("Membaca Web...", true);
    appendLog("Mengirim sinyal GET_PAGE_INFO ke tab aktif...");

    chrome.runtime.sendMessage(
      {
        action: "EXECUTE_IN_CONTENT",
        payload: { type: "GET_PAGE_INFO" }
      },
      (response) => {
        setStatus("Siap", false);
        if (response && response.success && response.data && response.data.pageInfo) {
          const info = response.data.pageInfo;
          appendLog(`Sukses membaca halaman: ${info.title}`);
          appendMessage(
            `📄 **Informasi Halaman Saat Ini:**\n` +
            `• **Judul**: ${info.title}\n` +
            `• **URL**: ${info.url}\n` +
            `• **Elemen Tombol**: ${info.interactiveElementsCount.buttons}\n` +
            `• **Elemen Link**: ${info.interactiveElementsCount.links}\n` +
            `• **Elemen Input/Form**: ${info.interactiveElementsCount.inputs}`
          );
        } else {
          appendLog(`Gagal: ${response?.error || "Tidak dapat terhubung ke halaman web."}`);
          appendMessage(`⚠️ Gagal membaca halaman web. Pastikan tab aktif adalah halaman website (bukan chrome:// setting).`);
        }
      }
    );
  });

  // Quick Action: Highlight Elements
  btnHighlightDOM.addEventListener("click", () => {
    setStatus("Highlighting...", true);
    appendLog("Memberikan highlight visual pada elemen interaktif...");

    chrome.runtime.sendMessage(
      {
        action: "EXECUTE_IN_CONTENT",
        payload: { type: "HIGHLIGHT_ELEMENTS" }
      },
      (response) => {
        setStatus("Siap", false);
        if (response && response.success && response.data) {
          const count = response.data.highlightedCount;
          appendLog(`Berhasil menghighlight ${count} elemen.`);
          appendMessage(`🎯 Berhasil menandai **${count}** elemen interaktif di halaman dengan garis merah.`);
        } else {
          appendLog(`Gagal: ${response?.error || "Gagal melakukan highlight."}`);
        }
      }
    );
  });

  // Send Prompt / Command
  async function handleSend() {
    const text = promptInput.value.trim();
    if (!text) return;

    appendMessage(text, true);
    promptInput.value = "";
    setStatus("Berpikir...", true);
    appendLog(`Perintah diterima: "${text}"`);

    const stored = await chrome.storage.local.get(["apiUrl", "apiKey"]);
    const apiUrl = stored.apiUrl;

    if (!apiUrl) {
      setTimeout(() => {
        setStatus("Siap", false);
        appendLog("Menunggu setup Cloudflare API URL.");
        appendMessage(
          `🤖 **Status Agent (PoC):**\n` +
          `Perintah Anda: _"${text}"_\n\n` +
          `ℹ️ Ekstensi siap dihubungkan dengan Cloudflare Pages API. Buka icon ⚙️ di pojok kanan atas untuk memasukkan URL endpoint Cloudflare Anda.`
        );
      }, 800);
      return;
    }

    const targetUrl = apiUrl.trim();

    try {
      appendLog(`Mengirim request ke API Proxy: ${targetUrl}`);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(stored.apiKey ? { "Authorization": `Bearer ${stored.apiKey}` } : {})
        },
        body: JSON.stringify({ prompt: text })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
      }

      const data = await res.json();
      setStatus("Siap", false);
      appendLog("Menerima respon dari AI API Proxy.");
      appendMessage(data.reply || JSON.stringify(data));
    } catch (err) {
      setStatus("Error", false);
      appendLog(`Error API: ${err.message}`);
      appendMessage(`❌ Terjadi kesalahan saat memanggil API: ${err.message}`);
    }
  }

  btnSend.addEventListener("click", handleSend);
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
});
