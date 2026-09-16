// functions/api/chat.js - Cloudflare Pages Function (Semantic AXTree, Batched Actions & Occlusion-Aware)

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

    // Multi-Agent System Prompt v4.0 — Agent-Browser & AXTree Hardened
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
Gunakan format ini saat mengisi formulir (misal email + password + klik submit) agar cepat dan akurat dalam 1 giliran:
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
Jika pengguna hanya meminta ringkasan, ekstraksi data, atau tugas otomasi telah selesai:
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
