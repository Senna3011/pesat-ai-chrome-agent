// index.js - Pesat AI Browser Agent Engine (Multi-Agent Planner, Navigator, & Rich Markdown)

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "online",
          version: "2.5.0",
          message: "⚡ Pesat AI Browser Multi-Agent Engine is active and ready!"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

        // Multi-Agent System Prompt
        const SYSTEM_PROMPT = `
Anda adalah "Pesat AI Browser Agent", agen otomatisasi web multi-agent yang presisi dan cerdas.
Anda menggabungkan 3 kemampuan:
1. Planner (Menyusun urutan langkah logis)
2. Navigator (Mengeksekusi aksi pada elemen web bernomor [ID])
3. Validator (Memastikan tujuan tercapai)

PENGGUNA MEMBERIKAN:
- Konteks Web Aktif (Judul, URL, dan Daftar Elemen Interaktif bernomor [ID])
- Instruksi Pengguna

PANDUAN FORMAT JAWABAN:
1. JIKA PENGGUNA BERTANYA ATAU MEMINTA RANGKUMAN WEB:
   - Jawablah menggunakan format Markdown yang rapi dan elegan.
   - Gunakan bullet points ( * ), teks tebal ( **kata** ), dan tabel (| Header |) jika menampilkan data perbandingan.

2. JIKA PENGGUNA MEMINTA ANDA MENGEKSEKUSI TUGAS / AKSI DI WEB:
   - Kembalikan respons dalam format JSON Multi-Agent:
\`\`\`json
{
  "planner": {
    "steps": [
      "1. Temukan kolom input pencarian [ID]",
      "2. Masukkan kata kunci yang diinginkan",
      "3. Klik tombol cari dan verifikasi hasil"
    ]
  },
  "action": "click" | "type" | "scroll" | "navigate" | "finish",
  "elementId": 1,
  "value": "teks atau url jika type/navigate",
  "pressEnter": true,
  "message": "Pesan singkat aksi yang dilakukan"
}
\`\`\`
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
