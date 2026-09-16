// index.js - Cloudflare Worker Entrypoint (Supports *.workers.dev)

export default {
  async fetch(request, env, ctx) {
    // Header CORS agar Chrome Extension bisa memanggil API ini
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle Preflight OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Handle GET (Status Check)
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "online",
          message: "⚡ Pesat AI Agent API Proxy (Worker) is active and running!"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Handle POST
    if (request.method === "POST") {
      try {
        const body = await request.json();
        const userPrompt = body.prompt || "";
        const conversationHistory = body.messages || [];

        // Konfigurasi API AI Internal dari Environment Variables
        const AI_BASE_URL = env.AI_BASE_URL || "https://api.internal-perusahaan.com/v1/chat/completions";
        const AI_API_KEY = env.AI_API_KEY || "";

        const payload = {
          model: env.AI_MODEL_NAME || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Anda adalah AI Browser Agent yang cerdas dan presisi. Tugas Anda adalah membantu pengguna mengotomatisasi atau mengekstrak informasi dari halaman web dalam bentuk instruksi/aksi yang terstruktur."
            },
            ...conversationHistory,
            ...(userPrompt ? [{ role: "user", content: userPrompt }] : [])
          ]
        };

        // Jika API Key belum disetting (mode demo / mock)
        if (!AI_API_KEY) {
          return new Response(
            JSON.stringify({
              success: true,
              reply: `🤖 [Pesat AI Worker Connected]\nPrompt diterima: "${userPrompt}".\n\nKoneksi Cloudflare Worker berhasil! Silakan masukkan AI_API_KEY di dashboard Cloudflare untuk menghubungkan ke model AI internal perusahaan.`,
              mock: true
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        // Teruskan ke API AI Internal
        const aiResponse = await fetch(AI_BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${AI_API_KEY}`
          },
          body: JSON.stringify(payload)
        });

        const data = await aiResponse.json();
        const reply = data.choices?.[0]?.message?.content || data.reply || JSON.stringify(data);

        return new Response(
          JSON.stringify({ success: true, reply }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
};
