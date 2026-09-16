// functions/api/chat.js - Cloudflare Pages Function (Supports Autonomous Actions & JSON Actions)

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const body = await request.json();
    const userPrompt = body.prompt || "";
    const conversationHistory = body.messages || [];

    const authHeader = request.headers.get("Authorization") || "";
    const headerKey = authHeader.replace(/^Bearer\s+/i, "").trim();
    const AI_API_KEY = headerKey || env.AI_API_KEY || "";
    
    const AI_BASE_URL = env.AI_BASE_URL || "https://api.pesatrouter.com/v1/chat/completions";
    const AI_MODEL_NAME = env.AI_MODEL_NAME || "pesat-flash";

    const SYSTEM_PROMPT = `
Anda adalah "Pesat AI Browser Agent", asisten otomatisasi peramban web tingkat lanjut yang cerdas, presisi, dan ramah.
Anda bertugas membantu pengguna menganalisis halaman web dan mengeksekusi aksi interaktif pada peramban.

PENGGUNA AKAN MEMBERIKAN:
1. Informasi halaman web yang sedang aktif (Judul, URL, dan Daftar Elemen Interaktif bernomor [ID]).
2. Instruksi atau pertanyaan dari pengguna.

ATURAN PERILAKU ANDA:
1. JIKA PENGGUNA BERTANYA (Misal: "Web apa ini?", "Rangkum isinya", "Jelaskan data di halaman ini"):
   - Jawablah secara langsung dalam bahasa Indonesia yang ramah, informatif, dan terstruktur (gunakan format Markdown yang rapi).
   - TIDAK PERLU mengembalikan JSON jika hanya menjawab pertanyaan biasa.

2. JIKA PENGGUNA MEMINTA ANDA MELAKUKAN AKSI (Misal: "Klik tombol login", "Cari produk laptop", "Ketik teks di input [ID]", "Scroll ke bawah"):
   - Anda HARUS mengembalikan respons dalam format JSON tunggal yang valid:
\`\`\`json
{
  "thought": "Jelaskan alasan dan pemikiran langkah Anda secara singkat",
  "action": "click" | "type" | "scroll" | "navigate" | "finish",
  "elementId": 1,
  "value": "Teks yang ingin diketik atau URL tujuan",
  "pressEnter": true,
  "message": "Pesan singkat yang mengonfirmasi aksi kepada pengguna"
}
\`\`\`

PILIHAN AKSI:
- "click": Mengklik tombol/link dengan elementId tertentu.
- "type": Mengisi teks pada input/textarea dengan elementId tertentu (set pressEnter: true jika ingin submit).
- "scroll": Menggulung halaman (value: "down" atau "up").
- "navigate": Membuka URL baru (value: "https://...").
- "finish": Tugas telah selesai dilakukan.
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

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
  });
}
