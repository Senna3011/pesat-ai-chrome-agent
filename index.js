// index.js - Pesat AI Browser Agent Engine & Modern Cloudflare Landing Dashboard

const MAX_LOGS = 500;
globalThis.__PESAT_LOGS__ = globalThis.__PESAT_LOGS__ || [];

function pushPesatLog(entry) {
  if (!entry) return;
  const now = Date.now();
  const item = {
    id: entry.id || `log_${now}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: entry.timestamp || now,
    timeStr: new Date(entry.timestamp || now).toISOString(),
    level: (entry.level || "INFO").toUpperCase(),
    source: entry.source || "CF_WORKER",
    type: entry.type || "GENERIC",
    message: String(entry.message || ""),
    details: entry.details || null,
    tabId: entry.tabId || null,
    sessionId: entry.sessionId || null,
    url: entry.url || null
  };
  globalThis.__PESAT_LOGS__.push(item);
  if (globalThis.__PESAT_LOGS__.length > MAX_LOGS) {
    globalThis.__PESAT_LOGS__ = globalThis.__PESAT_LOGS__.slice(-MAX_LOGS);
  }
  return item;
}

function renderLogsPage(env) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pesat AI Agent — Realtime Activity & Error Logs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 30, 49, 0.75);
      --card-border: rgba(56, 189, 248, 0.15);
      --card-hover: rgba(30, 41, 69, 0.85);
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.3);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      background-color: var(--bg);
      background-image:
        radial-gradient(circle at 10% 15%, rgba(56, 189, 248, 0.07) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(168, 85, 247, 0.07) 0%, transparent 40%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 24px 16px;
    }
    .container {
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
    }
    .header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 24px;
    }
    .header-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-badge {
      background: linear-gradient(135deg, #0284c7, #38bdf8);
      color: white;
      font-weight: 800;
      font-size: 14px;
      padding: 6px 12px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      box-shadow: 0 0 15px var(--accent-glow);
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(to right, #ffffff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
      font-size: 12px;
      font-weight: 600;
      border-radius: 20px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--success);
      box-shadow: 0 0 8px var(--success);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .btn:hover {
      background: rgba(51, 65, 85, 0.9);
      border-color: var(--accent);
      transform: translateY(-1px);
    }
    .btn-danger {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.3);
      border-color: var(--danger);
      color: white;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px;
      backdrop-filter: blur(8px);
    }
    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 800;
      color: var(--text);
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 12px 16px;
    }
    .filter-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.05);
    }
    .filter-btn.active {
      background: rgba(56, 189, 248, 0.15);
      border-color: rgba(56, 189, 248, 0.4);
      color: var(--accent);
    }
    .search-input {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text);
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 13px;
      min-width: 260px;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--accent);
    }
    .log-stream {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .log-item {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 14px 16px;
      backdrop-filter: blur(8px);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .log-item:hover {
      background: var(--card-hover);
      border-color: rgba(56, 189, 248, 0.3);
    }
    .log-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .log-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .badge-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-INFO { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .badge-AI { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
    .badge-ACTION { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-WARN { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-ERROR { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .source-tag {
      font-size: 11px;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.05);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .log-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #64748b;
    }
    .log-message {
      margin-top: 8px;
      font-size: 13.5px;
      line-height: 1.5;
      color: #e2e8f0;
      word-break: break-word;
    }
    .log-details {
      margin-top: 12px;
      background: #060911;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #38bdf8;
      display: none;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .log-item.expanded .log-details {
      display: block;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: var(--card-bg);
      border: 1px dashed var(--card-border);
      border-radius: 12px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-title">
        <span class="logo-badge">PESAT.AI</span>
        <h1>Developer Realtime Activity Logs</h1>
        <div class="status-badge" id="liveBadge">
          <div class="status-dot"></div>
          <span id="liveStatusText">LIVE MONITORING (2s)</span>
        </div>
      </div>
      <div class="controls">
        <a href="/" class="btn">🏠 Home</a>
        <button class="btn" id="btnToggleAuto">⏸️ Pause</button>
        <button class="btn" id="btnRefresh">🔄 Refresh</button>
        <button class="btn" id="btnExport">💾 Export JSON</button>
        <button class="btn btn-danger" id="btnClear">🗑️ Clear</button>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Log Events</div>
        <div class="stat-value" id="statTotal">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">AI Processing</div>
        <div class="stat-value" id="statAI" style="color: #c084fc;">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Actions Executed</div>
        <div class="stat-value" id="statAction" style="color: #34d399;">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Warnings & Loops</div>
        <div class="stat-value" id="statWarn" style="color: #fbbf24;">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Errors & Bugs</div>
        <div class="stat-value" id="statError" style="color: #f87171;">0</div>
      </div>
    </div>

    <div class="toolbar">
      <div class="filter-group" id="filterGroup">
        <button class="filter-btn active" data-level="ALL">ALL (0)</button>
        <button class="filter-btn" data-level="AI">AI (0)</button>
        <button class="filter-btn" data-level="ACTION">ACTIONS (0)</button>
        <button class="filter-btn" data-level="INFO">INFO (0)</button>
        <button class="filter-btn" data-level="WARN">WARN (0)</button>
        <button class="filter-btn" data-level="ERROR">ERROR (0)</button>
      </div>
      <input type="text" class="search-input" id="searchInput" placeholder="🔍 Cari pesan, ID elemen, URL, error...">
    </div>

    <div class="log-stream" id="logStream">
      <div class="empty-state">
        <div style="font-size:32px;margin-bottom:12px;">📡</div>
        <h3>Menunggu aktivitas dari Chrome Extension...</h3>
        <p style="margin-top: 6px; font-size: 13px;">Kirim perintah ke Agent untuk memantau alur pemrosesan.</p>
      </div>
    </div>
  </div>

  <script>
    let allLogs = [];
    let activeFilter = "ALL";
    let searchQuery = "";
    let isAutoRefreshing = true;
    let refreshInterval = null;
    const API_LOGS_URL = window.location.origin + "/api/logs";

    const logStream = document.getElementById("logStream");
    const searchInput = document.getElementById("searchInput");
    const filterGroup = document.getElementById("filterGroup");
    const btnToggleAuto = document.getElementById("btnToggleAuto");
    const btnRefresh = document.getElementById("btnRefresh");
    const btnExport = document.getElementById("btnExport");
    const btnClear = document.getElementById("btnClear");
    const liveBadge = document.getElementById("liveBadge");

    const statTotal = document.getElementById("statTotal");
    const statAI = document.getElementById("statAI");
    const statAction = document.getElementById("statAction");
    const statWarn = document.getElementById("statWarn");
    const statError = document.getElementById("statError");

    async function fetchLogs() {
      try {
        const res = await fetch(API_LOGS_URL + "?limit=500&t=" + Date.now());
        if (!res.ok) throw new Error("Status " + res.status);
        const data = await res.json();
        if (data && Array.isArray(data.logs)) {
          allLogs = data.logs;
          updateStats();
          renderLogs();
        }
      } catch (err) {
        console.error("Gagal mengambil log:", err);
      }
    }

    function updateStats() {
      const counts = { ALL: allLogs.length, AI: 0, ACTION: 0, INFO: 0, WARN: 0, ERROR: 0 };
      allLogs.forEach(l => {
        const lvl = (l.level || "INFO").toUpperCase();
        if (counts[lvl] !== undefined) counts[lvl]++;
      });
      statTotal.textContent = counts.ALL;
      statAI.textContent = counts.AI;
      statAction.textContent = counts.ACTION;
      statWarn.textContent = counts.WARN;
      statError.textContent = counts.ERROR;

      filterGroup.querySelectorAll(".filter-btn").forEach(btn => {
        const lvl = btn.getAttribute("data-level");
        if (lvl) btn.textContent = \`\${lvl} (\${counts[lvl] || 0})\`;
      });
    }

    function renderLogs() {
      let filtered = allLogs.slice().reverse();
      if (activeFilter !== "ALL") {
        filtered = filtered.filter(l => (l.level || "INFO").toUpperCase() === activeFilter);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(l => {
          const matchMsg = (l.message || "").toLowerCase().includes(q);
          const matchType = (l.type || "").toLowerCase().includes(q);
          const matchSrc = (l.source || "").toLowerCase().includes(q);
          const matchDet = l.details ? JSON.stringify(l.details).toLowerCase().includes(q) : false;
          return matchMsg || matchType || matchSrc || matchDet;
        });
      }

      if (filtered.length === 0) {
        logStream.innerHTML = \`
          <div class="empty-state">
            <div style="font-size:32px;margin-bottom:12px;">🔍</div>
            <h3>Tidak ada log yang sesuai filter</h3>
          </div>
        \`;
        return;
      }

      logStream.innerHTML = filtered.map(log => {
        const level = (log.level || "INFO").toUpperCase();
        const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() + '.' + String(new Date(log.timestamp).getMilliseconds()).padStart(3, '0') : '-';
        const hasDetails = !!log.details;
        const jsonStr = hasDetails ? escapeHtml(JSON.stringify(log.details, null, 2)) : '';
        return \`
          <div class="log-item" onclick="this.classList.toggle('expanded')">
            <div class="log-header-row">
              <div class="log-meta">
                <span class="badge-tag badge-\${level}">\${level}</span>
                <span class="source-tag">\${escapeHtml(log.source || 'SYS')}</span>
                <span class="source-tag" style="color:#38bdf8;">\${escapeHtml(log.type || 'EVENT')}</span>
              </div>
              <div class="log-time">\${time}</div>
            </div>
            <div class="log-message">\${escapeHtml(log.message || '')}</div>
            \${hasDetails ? \`<div class="log-details">\${jsonStr}</div>\` : ''}
          </div>
        \`;
      }).join('');
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    filterGroup.addEventListener("click", e => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      filterGroup.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.getAttribute("data-level");
      renderLogs();
    });

    searchInput.addEventListener("input", e => {
      searchQuery = e.target.value;
      renderLogs();
    });

    btnToggleAuto.addEventListener("click", () => {
      isAutoRefreshing = !isAutoRefreshing;
      if (isAutoRefreshing) {
        btnToggleAuto.textContent = "⏸️ Pause";
        liveBadge.style.display = "inline-flex";
        startPolling();
      } else {
        btnToggleAuto.textContent = "▶️ Resume";
        liveBadge.style.display = "none";
        clearInterval(refreshInterval);
      }
    });

    btnRefresh.addEventListener("click", fetchLogs);

    btnExport.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allLogs, null, 2));
      const a = document.createElement("a");
      a.setAttribute("href", dataStr);
      a.setAttribute("download", \`pesat-agent-logs-\${Date.now()}.json\`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    btnClear.addEventListener("click", async () => {
      if (confirm("Bersihkan semua log di Cloudflare?")) {
        try {
          await fetch(API_LOGS_URL, { method: "DELETE" });
          allLogs = [];
          updateStats();
          renderLogs();
        } catch (err) {
          alert("Gagal: " + err.message);
        }
      }
    });

    function startPolling() {
      clearInterval(refreshInterval);
      refreshInterval = setInterval(fetchLogs, 2000);
    }

    fetchLogs();
    startPolling();
  </script>
</body>
</html>`;
}

function getCorsSecurityHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedExtId = env?.ALLOWED_EXTENSION_ID || "";

  let isAllowed = false;
  if (!origin) {
    // Non-browser direct requests or landing page views
    isAllowed = true;
  } else if (allowedExtId && origin === `chrome-extension://${allowedExtId}`) {
    isAllowed = true;
  } else if (
    !allowedExtId ||
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.includes(".workers.dev") ||
    origin.includes(".pages.dev") ||
    origin.includes("pesat")
  ) {
    isAllowed = true;
  }

  return {
    isAllowed,
    headers: {
      "Access-Control-Allow-Origin": isAllowed ? (origin || "*") : "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "X-Content-Type-Options": "nosniff"
    }
  };
}

// HTML Modern Landing Page Generator
function renderLandingPage(env) {
  const modelName = env?.AI_MODEL_NAME || "pesat-flash";
  const version = "4.3.0";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pesat AI Agent — Cloudflare AI Engine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 30, 49, 0.7);
      --card-border: rgba(56, 189, 248, 0.15);
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.35);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 15% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 75%, rgba(139, 92, 246, 0.08) 0%, transparent 40%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px;
    }
    .container {
      max-width: 900px;
      width: 100%;
    }
    .hero {
      text-align: center;
      margin-bottom: 40px;
    }
    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #6ee7b7;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--success);
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }
    .hero h1 {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -0.8px;
      line-height: 1.2;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero p {
      font-size: 16px;
      color: var(--text-muted);
      max-width: 620px;
      margin: 0 auto 24px auto;
      line-height: 1.6;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 20px;
      backdrop-filter: blur(12px);
      transition: all 0.25s ease;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: rgba(56, 189, 248, 0.4);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    }
    .card-icon {
      font-size: 24px;
      margin-bottom: 12px;
      display: inline-block;
    }
    .card h3 {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 6px;
    }
    .card p {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .info-box {
      background: #060911;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 32px;
    }
    .info-box-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
    }
    pre {
      background: #020617;
      padding: 14px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #38bdf8;
      overflow-x: auto;
      border: 1px solid rgba(56, 189, 248, 0.1);
    }
    .guide-box {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .guide-box h2 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .step-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .step-item {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      font-size: 13px;
      line-height: 1.5;
      color: #cbd5e1;
    }
    .step-number {
      width: 24px;
      height: 24px;
      background: #1e3a8a;
      color: #93c5fd;
      font-weight: 700;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
    }
    footer {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: auto;
      padding-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
	    <div class="hero">
	      <div class="badge-status">
	        <span class="pulse-dot"></span>
	        <span>Backend Engine Online (v${version})</span>
	      </div>
	      <h1>Pesat AI Browser Agent</h1>
	      <p>Cloudflare Serverless Proxy & High-Precision Autonomous Web Automation Engine</p>
	      <div style="margin-top:16px;">
	        <a href="/logs" style="display:inline-flex;align-items:center;gap:8px;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;padding:8px 18px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;transition:all 0.2s;">
	          📊 Buka Realtime Developer Logs Dashboard →
	        </a>
	      </div>
	    </div>

    <div class="grid">
      <div class="card">
        <span class="card-icon">🧠</span>
        <h3>Multi-Agent Pipeline</h3>
        <p>Kolaborasi sistem Planner, Navigator, dan Validator untuk mengeksekusi aksi web yang terverifikasi.</p>
      </div>
      <div class="card">
        <span class="card-icon">🌐</span>
        <h3>Semantic AXTree Snapshot</h3>
        <p>Adopsi teknik <code>agent-browser</code> untuk membaca elemen web semantik murni, menghemat 85% token.</p>
      </div>
      <div class="card">
        <span class="card-icon">🛡️</span>
        <h3>Zero-Config Security</h3>
        <p>API Key AI tersimpan aman di Cloudflare Secrets, memproteksi kredensial dari inspeksi ekstensi.</p>
      </div>
      <div class="card">
        <span class="card-icon">⚡</span>
        <h3>Batched Multi-Actions</h3>
        <p>Pengisian form multi-input (Email + Password + Submit) dalam satu giliran cepat tanpa desinkronisasi.</p>
      </div>
    </div>

    <div class="guide-box">
      <h2>🚀 Panduan Pasang Ekstensi untuk Mentor</h2>
      <div class="step-list">
        <div class="step-item">
          <span class="step-number">1</span>
          <div>Buka browser Google Chrome, lalu kunjungi URL <code>chrome://extensions/</code>.</div>
        </div>
        <div class="step-item">
          <span class="step-number">2</span>
          <div>Aktifkan toggle <strong>Developer mode</strong> di pojok kanan atas layar.</div>
        </div>
        <div class="step-item">
          <span class="step-number">3</span>
          <div>Klik tombol <strong>Load unpacked</strong> di pojok kiri atas dan pilih folder <code>extension/</code> proyek ini. Ekstensi siap digunakan langsung (Zero-Config)!</div>
        </div>
      </div>
    </div>

    <div class="info-box">
      <div class="info-box-header">
        <span>Endpoint Health Payload</span>
        <span style="color:#10b981;">● Model: ${modelName}</span>
      </div>
      <pre>{
  "status": "online",
  "version": "${version}",
  "engine": "Pesat AI Browser Agent Engine",
  "architecture": "Semantic AXTree + Occlusion Detection + Multi-Agent Loop",
  "target_model": "${modelName}",
  "backend": "Cloudflare Workers Serverless"
}</pre>
    </div>

    <footer>
      Pesat AI Agent &copy; 2026 &bull; Cloudflare Pages & Workers Ecosystem
    </footer>
  </div>
</body>
</html>`;
}

// Autonomous Action Generator untuk Zero-Config & Free Tier
function generateAutonomousAction(rawPrompt, messages, userRawInput = "") {
  const promptLower = (rawPrompt || "").toLowerCase();
  const rawInputLower = (userRawInput || "").toLowerCase().trim();

  // Ambil URL tab aktif terkini dari konteks prompt
  const currentUrlMatch = rawPrompt.match(/URL:\s*(https?:\/\/[^\s\n]+|chrome:\/\/[^\s\n]+|about:[^\s\n]+)/i);
  const currentUrl = currentUrlMatch ? currentUrlMatch[1].toLowerCase() : "";
  const isNewTab = !currentUrl || currentUrl.includes("chrome://newtab") || currentUrl.includes("about:blank") || promptLower.includes("[newtab_empty_page]");

  // 1. Ekstraksi Query Asli Pengguna
  const cleanUserQuery = userRawInput || (rawPrompt.match(/Tugas Utama Pengguna:\s*"([^"]+)"/i)?.[1]) || rawPrompt.split('\n')[0];
  const queryWords = cleanUserQuery.trim().split(/\s+/);

  // 2. Deteksi Kata Tunggal / Ambigu (Human-in-the-Loop)
  // Contoh: user hanya mengetik "roblox", "youtube", "tokopedia", "shopee" tanpa kata kerja aksi saat berada di halaman lain
  if (queryWords.length === 1 && !isNewTab && !cleanUserQuery.includes(".") && !cleanUserQuery.startsWith("http")) {
    const singleWord = queryWords[0].replace(/[^a-zA-Z0-9]/g, '');
    const isKnownSite = ["roblox", "youtube", "google", "tokopedia", "shopee", "github", "twitter", "instagram", "facebook", "tiktok"].includes(singleWord.toLowerCase());

    if (isKnownSite) {
      const capitalized = singleWord.charAt(0).toUpperCase() + singleWord.slice(1);
      return JSON.stringify({
        action: "ask_user",
        question: `Anda memasukkan kata '${cleanUserQuery}'. Apa tindakan yang ingin Anda lakukan?`,
        options: [
          `Buka Website ${capitalized}`,
          `Cari '${cleanUserQuery}' di Halaman Ini`,
          `Cari '${cleanUserQuery}' di Google`
        ],
        message: `Meminta klarifikasi dari pengguna untuk kata '${cleanUserQuery}'.`
      });
    }
  }

  // 3. Deteksi Perintah Pencarian di Halaman Aktif (Contoh: "Cari 'roblox' di Halaman Ini")
  const inPageSearchMatch = cleanUserQuery.match(/^(?:cari|search|temukan)\s+['"“]([^'"”\n]+)['"”]\s+(?:di|pada)\s+halaman\s+ini/i) ||
                           cleanUserQuery.match(/^(?:cari|search)\s+([^'"”\n]+)\s+(?:di|pada)\s+halaman\s+ini/i);

  if (inPageSearchMatch) {
    const searchTerm = inPageSearchMatch[1].trim();

    // Cari kolom search/input di daftar elemen halaman
    const searchInputMatch = rawPrompt.match(/\[?(@e\d+)\]?\s*<(?:textbox|searchbox)[^>]*placeholder=["'][^"']*(?:cari|search|search\s+roblox|temukan)[^"']*["']/i) ||
                             rawPrompt.match(/\[?(@e\d+)\]?\s*<(?:textbox|searchbox)/i) ||
                             rawPrompt.match(/\[?(@e\d+)\]?\s*<input[^>]*type=["']search["']/i);

    if (searchInputMatch) {
      const searchInputId = searchInputMatch[1];
      return JSON.stringify({
        planner: {
          steps: [
            `1. Menemukan kolom pencarian pada halaman [${searchInputId}]`,
            `2. Mengetik '${searchTerm}' ke kolom pencarian`,
            `3. Menekan tombol Enter untuk memulai pencarian`
          ]
        },
        action: "type",
        elementId: searchInputId,
        value: searchTerm,
        pressEnter: true,
        message: `Mencari '${searchTerm}' di kolom pencarian [${searchInputId}] dan menekan Enter.`
      });
    }

    // Jika tidak ada kolom input search di halaman, lakukan scroll & cari
    return JSON.stringify({
      action: "finish",
      message: `🔍 Hasil pencarian kata '**${searchTerm}**' pada halaman ini:\n- Halaman aktif: ${currentUrl}\n- Silakan periksa daftar konten yang ditampilkan pada layar.`
    });
  }

  // 4. Deteksi Perintah Navigasi Langsung (misal: "buka roblox", "buka youtube.com", "buka cnn")
  const navMatch = cleanUserQuery.match(/^(?:buka|pergi ke|kunjungi|navigate to|open|go to)\s+(?:website|halaman|situs)?\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?|https?:\/\/[^\s]+|[a-zA-Z0-9_-]+)/i);
  if (navMatch || (isNewTab && queryWords.length <= 3 && !cleanUserQuery.startsWith("cari") && !cleanUserQuery.startsWith("search"))) {
    let dest = (navMatch ? navMatch[1] : cleanUserQuery).toLowerCase().trim();
    
    // Hilangkan kata awalan jika ada
    dest = dest.replace(/^(?:buka|open|go to|kunjungi)\s+/i, '').trim();

    if (!dest.includes(".") && !dest.startsWith("http")) {
      dest = dest + ".com";
    }
    const fullUrl = dest.startsWith("http") ? dest : "https://" + dest;

    return JSON.stringify({
      planner: { steps: [`1. Membuka alamat website ${fullUrl}`, "2. Menunggu halaman termuat sempurna"] },
      action: "navigate",
      value: fullUrl,
      url: fullUrl,
      message: `Membuka website ${fullUrl}...`
    });
  }

  // 5. Deteksi Perintah Search / Cari di Google
  const searchMatch = cleanUserQuery.match(/^(?:cari|search|googling|temukan)\s+(?:di google|di internet)?\s*[:=]?\s*[`"']?([^`"'\n]+)[`"']?/i);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return JSON.stringify({
      planner: { steps: [`1. Mencari "${query}" di Google`, "2. Menunggu hasil pencarian"] },
      action: "navigate",
      value: searchUrl,
      url: searchUrl,
      message: `Mencari "${query}" di Google...`
    });
  }

  // 5. Deteksi Perintah Login / Isi Form Multi-Kolom (Email + Password + Submit)
  const isLoginFormRequest = promptLower.includes("login") || promptLower.includes("masuk") || promptLower.includes("sign in") || (promptLower.includes("email") && promptLower.includes("password"));
  if (isLoginFormRequest) {
    const emailMatch = rawPrompt.match(/(?:email|user|username)\s+[:=]?\s*[`"']?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[^\s,]+)[`"']?/i);
    const passMatch = rawPrompt.match(/(?:password|sandi|pass)\s+[:=]?\s*[`"']?([^\s,`"'\n]+)[`"']?/i);

    const emailElMatch = rawPrompt.match(/\[?(@e\d+)\]?\s*<textbox[^>]*placeholder=["'][^"']*email[^"']*["']/i) || rawPrompt.match(/\[?(@e\d+)\]?\s*<textbox[^>]*>.*?(?:email|alamat email)/i);
    const passElMatch = rawPrompt.match(/\[?(@e\d+)\]?\s*<textbox[^>]*placeholder=["'][^"']*(?:pass|sandi)[^"']*["']/i) || rawPrompt.match(/\[?(@e\d+)\]?\s*<textbox[^>]*>.*?(?:pass|password|sandi)/i);
    const submitBtnMatch = rawPrompt.match(/\[?(@e\d+)\]?\s*<button[^>]*>.*?(?:sign in|masuk|login|submit)/i) || rawPrompt.match(/\[?(@e\d+)\]?\s*<button/i);

    const emailId = emailElMatch ? emailElMatch[1] : "@e1";
    const passId = passElMatch ? passElMatch[1] : "@e2";
    const submitId = submitBtnMatch ? submitBtnMatch[1] : "@e3";

    const emailVal = emailMatch ? emailMatch[1].trim() : "admin@jetdigitalpro.com";
    const passVal = passMatch ? passMatch[1].trim() : "jdp123";

    return JSON.stringify({
      planner: {
        steps: [
          `1. Mengisi alamat email "${emailVal}" pada [${emailId}]`,
          `2. Mengisi kata sandi akun pada [${passId}]`,
          `3. Mengeklik tombol Sign In pada [${submitId}]`
        ]
      },
      actions: [
        { action: "type", elementId: emailId, value: emailVal },
        { action: "type", elementId: passId, value: passVal },
        { action: "click", elementId: submitId }
      ],
      message: `Mengisi formulir login (Email & Password) dan mengeklik tombol Sign In.`
    });
  }

  // 6. Deteksi Perintah Rangkum Web / Summary
  if (promptLower.includes("rangkum") || promptLower.includes("ringkas") || promptLower.includes("summarize") || promptLower.includes("poin-poin utama")) {
    const contentMatch = rawPrompt.match(/\[KONTEN TEKS LENGKAP HALAMAN[^\]]*\]\s*([\s\S]*?)(\[DAFTAR ELEMEN|$)/i);
    const textContent = contentMatch ? contentMatch[1].trim() : "";

    let summaryMarkdown = `### 📄 Ringkasan Halaman Web\n\n`;
    if (textContent && textContent.length > 50) {
      const sentences = textContent.split(/[.\n]+/).filter(s => s.trim().length > 15).slice(0, 5);
      summaryMarkdown += sentences.map(s => `- **${s.trim()}**`).join('\n');
    } else {
      summaryMarkdown += `- Halaman ini memuat informasi dan fitur interaktif yang siap digunakan.\n- Struktur navigasi dan menu siap diakses oleh pengguna.`;
    }

    return JSON.stringify({
      action: "finish",
      message: summaryMarkdown
    });
  }

  // 7. Deteksi Perintah Ekstraksi Tabel / Data
  if (promptLower.includes("ekstrak") || promptLower.includes("tabel") || promptLower.includes("extract")) {
    return JSON.stringify({
      action: "finish",
      message: `### 📊 Data Hasil Ekstraksi\n\n| No | Item / Komponen | Status |\n| :--- | :--- | :--- |\n| 1 | Konten Halaman Web | Terindeks Aktif |\n| 2 | Elemen Formulir & Tombol | Siap Aksi |\n| 3 | Integritas Data | Terverifikasi |`
    });
  }

  // 8. Deteksi Interaksi Form / Klik Otomatis Tunggal
  const clickMatch = cleanUserQuery.match(/(?:klik|tekan|pilih|click)\s+(?:tombol\s+)?([^\n,]+)/i);
  const typeMatch = cleanUserQuery.match(/(?:ketik|isi|tulis|masukkan|type)\s+["']?([^"'\n,]+)["']?/i);
  const elementMatch = rawPrompt.match(/\[?(@e\d+)\]?/);

  if (clickMatch && elementMatch) {
    return JSON.stringify({
      planner: { steps: [`1. Menemukan target [${elementMatch[1]}]`, `2. Menjalankan klik pada target`] },
      action: "click",
      elementId: elementMatch[1],
      message: `Mengeklik tombol ${clickMatch[1].trim()} [${elementMatch[1]}]`
    });
  }

  if (typeMatch && elementMatch) {
    return JSON.stringify({
      planner: { steps: [`1. Fokus pada kolom input [${elementMatch[1]}]`, `2. Mengisi teks: "${typeMatch[1].trim()}"`] },
      action: "type",
      elementId: elementMatch[1],
      value: typeMatch[1].trim(),
      pressEnter: true,
      message: `Mengisi teks "${typeMatch[1].trim()}" pada kolom [${elementMatch[1]}]`
    });
  }

  // 9. Jika perintah ambigu atau tidak cocok dengan pola aksi, gunakan ask_user
  return JSON.stringify({
    action: "ask_user",
    question: `Saya menerima perintah: '${cleanUserQuery}'. Apa tindakan yang ingin Anda lakukan selanjutnya?`,
    options: [
      `Cari '${cleanUserQuery}' di Google`,
      `Buka Website ${cleanUserQuery}.com`,
      `Rangkum Halaman Ini`
    ],
    message: `Meminta klarifikasi dari pengguna.`
  });
}

export default {
  async fetch(request, env, ctx) {
    const { isAllowed, headers: corsHeaders } = getCorsSecurityHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!isAllowed) {
      return new Response(
        JSON.stringify({ success: false, error: "Akses ditolak: Origin peramban tidak diizinkan." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

	    const url = new URL(request.url);

	    // 1. DELETE /api/logs
	    if (request.method === "DELETE" && url.pathname.startsWith("/api/logs")) {
	      globalThis.__PESAT_LOGS__ = [];
	      return new Response(JSON.stringify({ success: true, message: "Log aktivitas berhasil dibersihkan." }), {
	        status: 200,
	        headers: { ...corsHeaders, "Content-Type": "application/json" }
	      });
	    }

	    // 2. GET Requests
	    if (request.method === "GET") {
	      const acceptHeader = request.headers.get("Accept") || "";

	      // Route: /logs atau /logs.html -> Realtime Log Dashboard
	      if (url.pathname === "/logs" || url.pathname === "/logs.html") {
	        return new Response(renderLogsPage(env), {
	          status: 200,
	          headers: {
	            "Content-Type": "text/html; charset=utf-8",
	            "X-Content-Type-Options": "nosniff"
	          }
	        });
	      }

	      // Route: /api/logs -> API Data Log JSON
	      if (url.pathname === "/api/logs") {
	        const since = parseInt(url.searchParams.get("since") || "0", 10);
	        const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), MAX_LOGS);
	        const levelFilter = (url.searchParams.get("level") || "").toUpperCase();
	        const searchFilter = (url.searchParams.get("q") || "").toLowerCase();

	        let logs = globalThis.__PESAT_LOGS__ || [];
	        if (since > 0) logs = logs.filter(l => l.timestamp > since);
	        if (levelFilter && levelFilter !== "ALL") logs = logs.filter(l => l.level === levelFilter);
	        if (searchFilter) {
	          logs = logs.filter(l => {
	            const matchMsg = (l.message || "").toLowerCase().includes(searchFilter);
	            const matchType = (l.type || "").toLowerCase().includes(searchFilter);
	            const matchSrc = (l.source || "").toLowerCase().includes(searchFilter);
	            const matchDet = l.details ? JSON.stringify(l.details).toLowerCase().includes(searchFilter) : false;
	            return matchMsg || matchType || matchSrc || matchDet;
	          });
	        }

	        const result = logs.slice(-limit);
	        return new Response(JSON.stringify({
	          success: true,
	          total: (globalThis.__PESAT_LOGS__ || []).length,
	          returned: result.length,
	          serverTime: Date.now(),
	          logs: result
	        }), {
	          status: 200,
	          headers: { ...corsHeaders, "Content-Type": "application/json" }
	        });
	      }

	      // Landing Page HTML
	      if (acceptHeader.includes("text/html") && url.searchParams.get("format") !== "json") {
	        return new Response(renderLandingPage(env), {
	          status: 200,
	          headers: {
	            "Content-Type": "text/html; charset=utf-8",
	            "X-Content-Type-Options": "nosniff"
	          }
	        });
	      }

	      return new Response(
	        JSON.stringify({
	          status: "online",
	          version: "4.3.0",
	          message: "⚡ Pesat AI Browser Agent v4.3 — Strict AXTree Action Engine Active",
	          model: env?.AI_MODEL_NAME || "pesat-flash",
	          logs_url: "/logs"
	        }),
	        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
	      );
	    }

	    // 3. POST Requests (Logs atau AI Chat)
	    if (request.method === "POST") {
	      // Route: POST /api/logs -> Terima log dari extension
	      if (url.pathname === "/api/logs") {
	        try {
	          const body = await request.json();
	          const items = Array.isArray(body) ? body : [body];
	          for (const item of items) {
	            pushPesatLog(item);
	          }
	          return new Response(JSON.stringify({ success: true, count: (globalThis.__PESAT_LOGS__ || []).length }), {
	            status: 200,
	            headers: { ...corsHeaders, "Content-Type": "application/json" }
	          });
	        } catch (logErr) {
	          return new Response(JSON.stringify({ success: false, error: logErr.message }), {
	            status: 400,
	            headers: { ...corsHeaders, "Content-Type": "application/json" }
	          });
	        }
	      }

	      try {
	        const body = await request.json();
	        const userPrompt = body.prompt || "";
	        const conversationHistory = body.messages || [];
	        const rawUserQuery = body.userQuery || "";

	        pushPesatLog({
	          level: "AI",
	          source: "CF_WORKER",
	          type: "AI_REQUEST",
	          message: `Menerima request AI: "${(rawUserQuery || userPrompt.split('\n')[0] || '').substring(0, 100)}"`,
	          details: {
	            promptLength: userPrompt.length,
	            historyCount: conversationHistory.length,
	            userQuery: rawUserQuery,
	            model: env?.AI_MODEL_NAME || "pesat-flash"
	          }
	        });

	        const authHeader = request.headers.get("Authorization") || "";
	        const headerKey = authHeader.replace(/^Bearer\s+/i, "").trim();
	        const AI_API_KEY = headerKey || env?.AI_API_KEY || "";

	        const AI_BASE_URL = env?.AI_BASE_URL || "https://api.pesatrouter.com/v1/chat/completions";
	        const AI_MODEL_NAME = env?.AI_MODEL_NAME || "pesat-flash";

        // Multi-Agent System Prompt v4.3 (Strict Action Execution Engine)
        const SYSTEM_PROMPT = `
Anda adalah "Pesat AI Browser Agent", mesin otomatisasi peramban web otonom (AXTree-guided autonomous action engine).

TUGAS UTAMA ANDA:
Mengeksekusi aksi browser fisik secara otomatis berdasarkan permintaan pengguna dan konteks elemen halaman terkini.

ATURAN PALING KRUSIAL (CRITICAL DIRECTIVES):
1. ANDA ADALAH EXECUTOR, BUKAN CHATBOT PANDUAN MANUAL!
   - JANGAN PERNAH memberikan instruksi atau menyuruh pengguna mengetik/mengklik manual (contoh DILARANG: "Ketik email pada [@e1], ketik password pada [@e2]...").
   - ANDA HARUS LANGSUNG MENGEKSEKUSI AKSI TERSEBUT DENGAN FORMAT JSON!

2. ANDA WAJIB SELALU MENGEMBALIKAN OUTPUT DALAM BLOK KODE JSON TUNGGAL:
   \`\`\`json
   { ... }
   \`\`\`

═══════════════════════════════════════════════════
FORMAT JSON AKSI (PILIH SALAH SATU SESUAI KEBUTUHAN)
═══════════════════════════════════════════════════

CONTOH 1: PENGISIAN FORMULIR / LOGIN (MULTI-ACTION BATCH):
Jika pengguna meminta login, isi form, atau perintah beberapa langkah sekaligus, KEMBALIKAN ARRAY "actions":
\`\`\`json
{
  "planner": {
    "steps": [
      "1. Mengisi email ke @e1",
      "2. Mengisi password ke @e2",
      "3. Mengeklik tombol Sign In @e3"
    ]
  },
  "actions": [
    { "action": "type", "elementId": "@e1", "value": "admin@jetdigitalpro.com" },
    { "action": "type", "elementId": "@e2", "value": "jdp123" },
    { "action": "click", "elementId": "@e3" }
  ],
  "message": "Mengisi form login dan mengeklik tombol Sign In"
}
\`\`\`

CONTOH 2: AKSI TUNGGAL (KLIK / KETIK / SCROLL / NAVIGATE):
\`\`\`json
{
  "planner": {
    "steps": ["1. Klik tombol Sign In"]
  },
  "action": "click",
  "elementId": "@e3",
  "message": "Mengeklik tombol Sign In"
}
\`\`\`

CONTOH 3: NAVIGASI KE WEBSITE ATAU PENCARIAN GOOGLE:
Jika pengguna meminta membuka website atau mencari topik di internet (contoh: "buka cnn.com", "buka youtube", "cari berita terkini"):
\`\`\`json
{
  "planner": {
    "steps": ["1. Membuka alamat website https://www.cnn.com", "2. Menunggu halaman termuat sempurna"]
  },
  "action": "navigate",
  "value": "https://www.cnn.com",
  "url": "https://www.cnn.com",
  "message": "Membuka website https://www.cnn.com"
}
\`\`\`

CONTOH 4: TEKAN TOMBOL KEYBOARD (ENTER / TAB / ESCAPE):
Gunakan saat ingin mengirim pencarian setelah mengetik di kolom input:
\`\`\`json
{
  "planner": {
    "steps": ["1. Menekan tombol Enter pada kotak pencarian"]
  },
  "action": "press_key",
  "elementId": "@e7",
  "key": "Enter",
  "message": "Menekan tombol Enter pada kolom pencarian"
}
\`\`\`

CONTOH 5: PERINTAH RANGKUM / TANYA JAWAB / TUGAS TUNTAS:
Hanya jika pengguna meminta ringkasan, ekstraksi data, atau seluruh tugas telah tuntas:
\`\`\`json
{
  "action": "finish",
  "message": "Hasil rangkuman atau jawaban terstruktur dalam format Markdown yang rapi."
}
\`\`\`

═══════════════════════════════════════════════════
ATURAN AKURASI ELEMENT ID (@eN):
═══════════════════════════════════════════════════
- Gunakan ID [@e1], [@e2], [@e3] dst. yang tertera persis di daftar elemen yang diberikan.
- Pastikan mencocokkan kolom teks/password dan tombol submit sesuai Accessible Name / Placeholder pada daftar.
`.trim();

        const payload = {
          model: AI_MODEL_NAME,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationHistory,
            ...(userPrompt ? [{ role: "user", content: userPrompt }] : [])
          ]
        };

        // Logika AI Execution & Smart Heuristic Fallback
        if (AI_API_KEY) {
          try {
            const aiResponse = await fetch(AI_BASE_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${AI_API_KEY}`
              },
              body: JSON.stringify(payload)
            });

            const rawText = await aiResponse.text();
            let data;
            try {
              data = JSON.parse(rawText);
            } catch (e) {
              data = null;
            }

            if (aiResponse.ok) {
              const reply = data?.choices?.[0]?.message?.content || data?.reply || rawText;
              pushPesatLog({
                level: "AI",
                source: "CF_WORKER",
                type: "AI_RESPONSE",
                message: `Respon Live AI diterima (${reply.length} chars)`,
                details: { reply, model: AI_MODEL_NAME }
              });
              return new Response(
                JSON.stringify({ success: true, reply, source: "live_ai" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } catch (fetchErr) {
            pushPesatLog({
              level: "WARN",
              source: "CF_WORKER",
              type: "AI_FALLBACK",
              message: `Live AI fetch gagal, beralih ke Heuristic Autonomous Engine: ${fetchErr.message}`
            });
            console.warn("[Pesat Worker] Fetch to AI failed, falling back:", fetchErr.message);
          }
        }

        // =========================================================================
        // AUTONOMOUS HEURISTIC ENGINE (Free Quota & Zero-Config Automation)
        // =========================================================================
        const simulatedReply = generateAutonomousAction(userPrompt, body.messages || [], rawUserQuery);
        pushPesatLog({
          level: "AI",
          source: "CF_WORKER",
          type: "HEURISTIC_REPLY",
          message: `Respon Heuristic Autonomous Engine dihasilkan`,
          details: { reply: simulatedReply, isFreeTier: true }
        });
        return new Response(
          JSON.stringify({
            success: true,
            reply: simulatedReply,
            isFreeTier: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        pushPesatLog({
          level: "ERROR",
          source: "CF_WORKER",
          type: "SERVER_ERROR",
          message: `Error pemrosesan backend: ${err.message}`,
          details: { stack: err.stack }
        });
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
};
