// functions/api/chat.js - Cloudflare Pages Function (Strict AXTree Action Engine)

function getCorsSecurityHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedExtId = env?.ALLOWED_EXTENSION_ID || "";

  let isAllowed = false;
  if (!origin) {
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

export async function onRequestPost(context) {
  const { request, env } = context;
  const { isAllowed, headers: corsHeaders } = getCorsSecurityHeaders(request, env);

  if (!isAllowed) {
    return new Response(
      JSON.stringify({ success: false, error: "Akses ditolak: Origin peramban tidak diizinkan." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await request.json();
    const userPrompt = body.prompt || "";
    const conversationHistory = body.messages || [];

    const authHeader = request.headers.get("Authorization") || "";
    const headerKey = authHeader.replace(/^Bearer\s+/i, "").trim();
    const AI_API_KEY = headerKey || env.AI_API_KEY || "";

    const AI_BASE_URL = env.AI_BASE_URL || "https://api.pesatrouter.com/v1/chat/completions";
    const AI_MODEL_NAME = env.AI_MODEL_NAME || "pesat-flash";

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

CONTOH 3: PERINTAH RANGKUM / TANYA JAWAB / TUGAS TUNTAS:
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
