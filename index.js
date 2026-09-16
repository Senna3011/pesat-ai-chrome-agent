// index.js - Pesat AI Browser Agent Engine & Modern Cloudflare Landing Dashboard

function getCorsSecurityHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedExtId = env?.ALLOWED_EXTENSION_ID || "";

  let isAllowed = false;
  if (!origin) {
    // Non-browser direct requests or landing page views
    isAllowed = true;
  } else if (allowedExtId && origin === `chrome-extension://${allowedExtId}`) {
    isAllowed = true;
  } else if (!allowedExtId && (origin.startsWith("chrome-extension://") || origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1"))) {
    isAllowed = true;
  }

  return {
    isAllowed,
    headers: {
      "Access-Control-Allow-Origin": isAllowed ? (origin || "*") : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    }
  };
}

// HTML Modern Landing Page Generator
function renderLandingPage(env) {
  const modelName = env?.AI_MODEL_NAME || "pesat-flash";
  const version = "4.2.0";

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
    /* Header & Hero */
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
    /* Grid Features */
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
    /* Code & Live Box */
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
    /* Quick Guide Steps */
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
    /* Footer */
    footer {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: auto;
      padding-top: 24px;
    }
    .btn-ping {
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-ping:hover {
      opacity: 0.9;
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

    // Handle GET Request
    if (request.method === "GET") {
      const url = new URL(request.url);
      const acceptHeader = request.headers.get("Accept") || "";

      // Jika diakses lewat browser (Accept: text/html) dan tidak minta ?format=json
      if (acceptHeader.includes("text/html") && url.searchParams.get("format") !== "json") {
        return new Response(renderLandingPage(env), {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      // Default JSON response untuk API / curl / health check
      return new Response(
        JSON.stringify({
          status: "online",
          version: "4.2.0",
          message: "⚡ Pesat AI Browser Agent v4.2 — Semantic AXTree, Batching & Landing Dashboard Active",
          model: env?.AI_MODEL_NAME || "pesat-flash"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle POST Request (AI Processing dari Extension)
    if (request.method === "POST") {
      try {
        const body = await request.json();
        const userPrompt = body.prompt || "";
        const conversationHistory = body.messages || [];

        const authHeader = request.headers.get("Authorization") || "";
        const headerKey = authHeader.replace(/^Bearer\s+/i, "").trim();
        const AI_API_KEY = headerKey || env.AI_API_KEY || "";

        const AI_BASE_URL = env.AI_BASE_URL || "https://api.pesatrouter.com/v1/chat/completions";
        const AI_MODEL_NAME = env.AI_MODEL_NAME || "pesat-flash";

        // Multi-Agent System Prompt v4.2
        const SYSTEM_PROMPT = `
Anda adalah "Pesat AI Browser Agent", asisten otomatisasi peramban web cerdas berakurasi tinggi (AXTree-guided).
Tugas Anda adalah memahami halaman web dan mengeksekusi aksi otomatis secara tepat, presisi, dan aman.

PENGGUNA MEMBERIKAN:
- Konteks Web Aktif (Judul, URL, Konten Teks Halaman)
- Daftar Elemen Aksesibilitas Semantik bernomor [@e1], [@e2], dst.
- Pertanyaan / Instruksi Pengguna

═══════════════════════════════════════════════════
STRUKTUR ELEMEN SEMANTIK (AXTree Format)
═══════════════════════════════════════════════════
Elemen disajikan dalam format:
[@eN] <role [states]> "Accessible Name / Visible Label"
Contoh:
[@e1] <textbox placeholder="Email" [required]> "Email Address"
[@e2] <textbox placeholder="Password" [required]> "Password"
[@e3] <button> "Masuk / Log In"
[@e4] <button [covered_by=<div#cookie-banner>]> "Beli Sekarang"

═══════════════════════════════════════════════════
FORMAT RESPON JSON AKSI (SINGLE ATAU BATCH)
═══════════════════════════════════════════════════
1. AKSI TUNGGAL (Single Action):
\`\`\`json
{
  "planner": {
    "steps": ["1. Klik tombol cari"]
  },
  "action": "click" | "type" | "select" | "scroll" | "navigate" | "wait" | "finish",
  "elementId": "@e1",
  "value": "teks atau url jika ada",
  "pressEnter": false,
  "message": "Menekan tombol cari"
}
\`\`\`

2. AKSI BATCH (Multi-Action Sekaligus untuk Form Cepat):
\`\`\`json
{
  "planner": {
    "steps": [
      "1. Isi email",
      "2. Isi password",
      "3. Klik tombol masuk"
    ]
  },
  "actions": [
    { "action": "type", "elementId": "@e1", "value": "user@email.com" },
    { "action": "type", "elementId": "@e2", "value": "secret123" },
    { "action": "click", "elementId": "@e3" }
  ],
  "message": "Mengisi form login dan menekan tombol masuk"
}
\`\`\`

3. TUGAS SELESAI ATAU JAWABAN TEKS MURNI:
\`\`\`json
{
  "action": "finish",
  "message": "Ringkasan / data yang diekstrak dalam format Markdown yang rapi"
}
\`\`\`

═══════════════════════════════════════════════════
ATURAN UTAMA AKURASI TINGGI (HIGH-PRECISION RULES)
═══════════════════════════════════════════════════
1. GUNAKAN HANDLE @eN YANG TEPAT:
   - Gunakan hanya ID elemen [@eN] yang tertera persis di daftar. Jangan pernah mengarang nomor.
2. WASPADAI ELEMEN TERTUTUP (Occlusion):
   - Jika elemen memiliki flag [covered_by=...], berarti tertutup popup/cookie banner/modal. Klik tombol tutup banner/modal terlebih dahulu sebelum menargetkan elemen tersebut.
3. KESESUAIAN URL:
   - Jika pengguna meminta aksi pada website tertentu namun browser masih berada di halaman lain, lakukan aksi "navigate" ke URL tujuan terlebih dahulu.
4. GULIR JIKA TARGET TIDAK ADA:
   - Jika tombol atau kolom yang dicari belum muncul di daftar, gunakan aksi "scroll" untuk menampilkan area bawah halaman.
5. JIKA RAGU ATAU PERLU INPUT MANUAL PENGGUNA:
   - Gunakan action "finish" dan jelaskan petunjuk kepada pengguna secara ramah.
`.trim();

        const payload = {
          model: AI_MODEL_NAME,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationHistory,
            ...(userPrompt ? [{ role: "user", content: userPrompt }] : [])
          ]
        };

        if (!AI_API_KEY) {
          return new Response(
            JSON.stringify({
              success: true,
              reply: `🤖 [Pesat AI Worker Connected]\nPrompt diterima.\n\nSilakan masukkan AI_API_KEY di dashboard Cloudflare untuk menghubungkan ke model AI nyata.`,
              mock: true
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

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

        if (!aiResponse.ok) {
          const errMsg = data?.error?.message || data?.message || rawText || `HTTP ${aiResponse.status}`;
          return new Response(
            JSON.stringify({ success: false, error: `AI Router Error (${aiResponse.status}): ${errMsg}` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const reply = data?.choices?.[0]?.message?.content || data?.reply || rawText;

        return new Response(
          JSON.stringify({ success: true, reply }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
};
