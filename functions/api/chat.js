// functions/api/chat.js - Cloudflare Pages Function (API Proxy & Middleware)

/**
 * Handler POST request dari Chrome Extension
 * Menjaga kerahasiaan API Key Internal perusahaan di sisi server (Cloudflare)
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // Header CORS agar Chrome Extension bisa memanggil API ini
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const body = await request.json();
    const userPrompt = body.prompt || "";
    const conversationHistory = body.messages || [];

    // Konfigurasi API AI Internal dari Cloudflare Environment Variables
    // (Bisa disetting di Dashboard Cloudflare Pages -> Settings -> Environment variables)
    const AI_BASE_URL = env.AI_BASE_URL || "https://api.internal-perusahaan.com/v1/chat/completions";
    const AI_API_KEY = env.AI_API_KEY || "";

    // Payload yang akan dikirim ke API AI Internal
    const payload = {
      model: env.AI_MODEL_NAME || "gpt-4o-mini", // Sesuaikan dengan model internal
      messages: [
        {
          role: "system",
          content: "Anda adalah AI Browser Agent yang cerdas dan presisi. Tugas Anda adalah membantu pengguna mengotomatisasi atau mengekstrak informasi dari halaman web dalam bentuk instruksi/aksi yang terstruktur."
        },
        ...conversationHistory,
        ...(userPrompt ? [{ role: "user", content: userPrompt }] : [])
      ]
    };

    // Jika API Key belum disetting di Cloudflare (mode demo/mock)
    if (!AI_API_KEY) {
      return new Response(
        JSON.stringify({
          success: true,
          reply: `[Cloudflare Pages Proxy Ready] Prompt diterima: "${userPrompt}". Silakan masukkan AI_API_KEY di dashboard Cloudflare Pages untuk menghubungkan ke model nyata.`,
          mock: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Teruskan request ke API AI Internal
    const response = await fetch(AI_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.message || rawText || `HTTP ${response.status}`;
      return new Response(
        JSON.stringify({ success: false, error: `AI Router Error (${response.status}): ${errMsg}` }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const assistantReply = data?.choices?.[0]?.message?.content || data?.reply || rawText;

    return new Response(
      JSON.stringify({ success: true, reply: assistantReply }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}

// Handler OPTIONS untuk CORS preflight request dari browser
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
  });
}
