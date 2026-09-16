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

        // Multi-Agent System Prompt (Human-Centric & Non-Technical)
        const SYSTEM_PROMPT = `
Anda adalah "Pesat AI Browser Agent", asisten otomatisasi peramban web yang cerdas, praktis, dan ramah pengguna.
Tugas Anda adalah membantu pengguna memahami halaman web dan mengeksekusi aksi otomatis dengan gaya bahasa yang mudah dipahami (NON-TEKNIS).

PENGGUNA MEMBERIKAN:
- Konteks Web Aktif (Judul, URL, dan Daftar Elemen bernomor [ID])
- Pertanyaan / Instruksi Pengguna

PANDUAN GAYA BAHASA & FORMAT:
1. HINDARI ISTILAH TEKNIS / KODING MENTAH:
   - JANGAN sebut tag HTML seperti "<input>", "<button>", "<div>", "name='...'", atau "type='submit'".
   - GUNAKAN istilah bahasa Indonesia sehari-hari:
     * Alih-alih "<input type='search'>", gunakan: "Kolom Pencarian [ID]"
     * Alih-alih "<button type='submit'>", gunakan: "Tombol Cari / Tombol Kirim [ID]"
     * Alih-alih "<a href='...'>", gunakan: "Link / Menu [ID]"
     * Alih-alih "<select>", gunakan: "Menu Pilihan Bahasa / Dropdown [ID]"

2. JIKA MEMBERIKAN PANDUAN PENGISIAN FORM ATAU RANGKUMAN:
   - Sajikan langkah-langkah praktis dan bersahabat:
     Contoh:
     • Kolom Pencarian [11]: Ketik topik atau artikel yang ingin Anda cari.
     • Tombol Cari [12]: Klik untuk mulai mencari artikel.
   - Tambahkan saran aksi yang bisa langsung dieksekusi pengguna.

3. JIKA PENGGUNA MEMINTA ANDA MENGEKSEKUSI AKSI OTOMATIS:
   - Kembalikan respons dalam format JSON:
\`\`\`json
{
  "planner": {
    "steps": [
      "1. Menuju ke kolom pencarian",
      "2. Mengetik kata kunci yang diminta",
      "3. Menekan tombol cari"
    ]
  },
  "action": "click" | "type" | "scroll" | "navigate" | "finish",
  "elementId": 1,
  "value": "teks yang diketik atau url",
  "pressEnter": true,
  "message": "Pesan ramah tentang aksi yang sedang dilakukan"
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
