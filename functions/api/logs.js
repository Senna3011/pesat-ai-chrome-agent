// functions/api/logs.js - Cloudflare Pages Function for Realtime Telemetry & 2-Tab Bug Report Dashboard

const MAX_LOGS = 500;
globalThis.__PESAT_LOGS__ = globalThis.__PESAT_LOGS__ || [];

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff"
  };
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, context.env)
  });
}

function renderTelemetryDashboardHtml(logs, total) {
  const bugReports = logs.filter(l => l.type === "BUG_REPORT" || l.source === "USER_BUG_REPORT");
  const devLogs = logs.filter(l => l.type !== "BUG_REPORT" && l.source !== "USER_BUG_REPORT");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pesat AI Telemetry & Bug Report Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0b0f19;
      --bg-card: #111827;
      --bg-card-hover: #1f2937;
      --border: #374151;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --font-sora: 'Sora', sans-serif;
      --font-sans: 'Plus Jakarta Sans', sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-primary);
      color: var(--text-main);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    .header-title {
      font-family: var(--font-sora);
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-actions {
      display: flex;
      gap: 12px;
    }
    .btn {
      background: var(--bg-card);
      color: var(--text-main);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn:hover {
      background: var(--bg-card-hover);
      border-color: var(--text-muted);
    }
    .btn-danger {
      background: #7f1d1d;
      border-color: #991b1b;
      color: #fecaca;
    }
    .btn-danger:hover {
      background: #991b1b;
    }
    .tabs-container {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    .tab-btn {
      background: none;
      border: none;
      padding: 12px 20px;
      font-family: var(--font-sora);
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: color 0.2s;
    }
    .tab-btn:hover {
      color: var(--text-main);
    }
    .tab-btn.active {
      color: var(--accent);
    }
    .tab-btn.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--accent);
    }
    .badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--border);
      color: var(--text-main);
      font-family: var(--font-sans);
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .table-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background: #1e293b;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 14px 16px;
      border-bottom: 1px solid #1f2937;
      vertical-align: top;
      font-size: 13.5px;
    }
    tr:hover td {
      background: var(--bg-card-hover);
    }
    .level-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .level-INFO { background: #1e3a8a; color: #93c5fd; }
    .level-WARN { background: #78350f; color: #fde68a; }
    .level-ERROR { background: #7f1d1d; color: #fca5a5; }
    .level-AI { background: #4c1d95; color: #d8b4fe; }
    .code-block {
      background: #0b0f19;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: Consolas, Monaco, monospace;
      font-size: 12px;
      color: #38bdf8;
      max-height: 120px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .empty-state {
      text-align: center;
      padding: 48px;
      color: var(--text-muted);
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">
      <span>🛡️ Pesat AI Centralized Telemetry</span>
    </div>
    <div class="header-actions">
      <button class="btn" onclick="location.reload()">🔄 Refresh</button>
      <button class="btn btn-danger" onclick="clearLogs()">🗑️ Bersihkan Semua Log</button>
    </div>
  </div>

  <div class="tabs-container">
    <button class="tab-btn active" onclick="switchTab('tab-dev')">
      ⚡ Dev Activity Logs
      <span class="badge">${devLogs.length}</span>
    </button>
    <button class="tab-btn" onclick="switchTab('tab-bugs')">
      🐞 User Bug Reports
      <span class="badge" style="background:#7f1d1d;color:#fecaca;">${bugReports.length}</span>
    </button>
  </div>

  <!-- TAB 1: DEV ACTIVITY LOGS -->
  <div id="tab-dev" class="tab-content active">
    <div class="table-card">
      ${devLogs.length === 0 ? '<div class="empty-state">Belum ada log aktivitas developer.</div>' : `
      <table>
        <thead>
          <tr>
            <th style="width:140px;">Waktu</th>
            <th style="width:80px;">Level</th>
            <th style="width:120px;">Sumber</th>
            <th style="width:140px;">Tipe</th>
            <th>Pesan & Detail</th>
          </tr>
        </thead>
        <tbody>
          ${devLogs.map(l => `
            <tr>
              <td style="color:var(--text-muted);font-size:12px;">${l.timeStr || new Date(l.timestamp).toLocaleTimeString()}</td>
              <td><span class="level-tag level-${l.level}">${l.level}</span></td>
              <td><strong>${l.source}</strong></td>
              <td><code>${l.type}</code></td>
              <td>
                <div>${escapeHtml(l.message)}</div>
                ${l.details ? `<div class="code-block" style="margin-top:6px;">${escapeHtml(typeof l.details === 'object' ? JSON.stringify(l.details, null, 2) : String(l.details))}</div>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </div>
  </div>

  <!-- TAB 2: USER BUG REPORTS -->
  <div id="tab-bugs" class="tab-content">
    <div class="table-card">
      ${bugReports.length === 0 ? '<div class="empty-state">Belum ada tiket laporan bug dari pengguna.</div>' : `
      <table>
        <thead>
          <tr>
            <th style="width:140px;">ID & Waktu</th>
            <th style="width:220px;">Deskripsi Pengguna</th>
            <th style="width:200px;">Halaman Web</th>
            <th>Error Stack & Snapshot</th>
          </tr>
        </thead>
        <tbody>
          ${bugReports.map(b => `
            <tr>
              <td>
                <div style="font-weight:700;color:var(--accent);">${b.id}</div>
                <div style="color:var(--text-muted);font-size:12px;">${b.timeStr || new Date(b.timestamp).toLocaleString('id-ID')}</div>
              </td>
              <td>
                <div style="font-weight:600;color:#fef08a;">${escapeHtml(b.details?.userDescription || b.message)}</div>
              </td>
              <td>
                <div style="font-size:12.5px;word-break:break-all;">
                  <a href="${b.url || b.details?.url || '#'}" target="_blank" style="color:#60a5fa;text-decoration:none;">${escapeHtml(b.details?.tabTitle || b.url || 'Tidak ada URL')}</a>
                </div>
              </td>
              <td>
                ${b.details?.lastError ? `<div style="color:#f87171;font-weight:600;margin-bottom:4px;">⚠️ Error: ${escapeHtml(b.details.lastError)}</div>` : ''}
                ${b.details?.domSnapshot ? `<details><summary style="cursor:pointer;color:#93c5fd;font-size:12px;">Lihat DOM Snapshot</summary><div class="code-block" style="margin-top:6px;">${escapeHtml(b.details.domSnapshot)}</div></details>` : '<span style="color:var(--text-muted);font-size:12px;">Tidak ada snapshot</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </div>
  </div>

  <script>
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      event.currentTarget.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    }

    async function clearLogs() {
      if (!confirm("Apakah Anda yakin ingin menghapus semua log dan laporan bug?")) return;
      await fetch(window.location.href, { method: "DELETE" });
      location.reload();
    }
  </script>
</body>
</html>`;
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);
  const url = new URL(request.url);

  const acceptHeader = request.headers.get("Accept") || "";
  const isHtmlRequest = acceptHeader.includes("text/html") || url.searchParams.get("format") === "html" || url.searchParams.has("ui");

  const since = parseInt(url.searchParams.get("since") || "0", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), MAX_LOGS);
  const levelFilter = (url.searchParams.get("level") || "").toUpperCase();
  const searchFilter = (url.searchParams.get("q") || "").toLowerCase();

  let logs = globalThis.__PESAT_LOGS__ || [];

  if (since > 0) {
    logs = logs.filter(l => l.timestamp > since);
  }

  if (levelFilter && levelFilter !== "ALL") {
    logs = logs.filter(l => l.level === levelFilter);
  }

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

  if (isHtmlRequest) {
    return new Response(renderTelemetryDashboardHtml(result, globalThis.__PESAT_LOGS__.length), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    total: globalThis.__PESAT_LOGS__.length,
    returned: result.length,
    serverTime: Date.now(),
    logs: result
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];
    const now = Date.now();

    for (const item of items) {
      if (!item) continue;
      const logEntry = {
        id: item.id || `log_${now}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: item.timestamp || now,
        timeStr: new Date(item.timestamp || now).toISOString(),
        level: (item.level || "INFO").toUpperCase(),
        source: item.source || "UNKNOWN",
        type: item.type || "GENERIC",
        message: String(item.message || ""),
        details: item.details || null,
        tabId: item.tabId || null,
        sessionId: item.sessionId || null,
        url: item.url || null
      };

      globalThis.__PESAT_LOGS__.push(logEntry);
    }

    if (globalThis.__PESAT_LOGS__.length > MAX_LOGS) {
      globalThis.__PESAT_LOGS__ = globalThis.__PESAT_LOGS__.slice(-MAX_LOGS);
    }

    return new Response(JSON.stringify({
      success: true,
      added: items.length,
      currentTotal: globalThis.__PESAT_LOGS__.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: "Invalid log payload: " + err.message
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);
  globalThis.__PESAT_LOGS__ = [];

  return new Response(JSON.stringify({
    success: true,
    message: "Semua log aktivitas berhasil dibersihkan."
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
