// functions/api/chat.js - Cloudflare Pages Function (Strict AXTree Action Engine)

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
    source: entry.source || "CF_PAGES",
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

function getCorsSecurityHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedExtId = env?.ALLOWED_EXTENSION_ID || "";

  let isAllowed = false;
  if (!origin) {
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
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "X-Content-Type-Options": "nosniff"
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

    // ── Endpoint Bug Report Proxy Handler ──
    if (body.action === "SUBMIT_BUG_REPORT" || body.isBugReport || body.userDescription) {
      const bugEntry = pushPesatLog({
        level: "WARN",
        source: "USER_BUG_REPORT",
        type: "BUG_REPORT",
        message: `[BUG REPORT] ${body.userDescription || "Tidak ada deskripsi"}`,
        details: {
          userDescription: body.userDescription || "",
          url: body.url || "",
          tabTitle: body.tabTitle || "",
          lastError: body.lastError || null,
          actionLogs: body.actionLogs || [],
          domSnapshot: body.domSnapshot ? String(body.domSnapshot).slice(0, 3000) : null,
          reportedAt: new Date().toISOString()
        },
        url: body.url || null
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Laporan bug berhasil diterima dan dicatat ke sistem telemetry.",
          reportId: bugEntry.id
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = body.prompt || "";
    const conversationHistory = body.messages || [];

    const isSummarize =
      !!body.isSummarize ||
      (typeof userPrompt === "string" &&
        (/\[TEKS UTAMA ARTIKEL/i.test(userPrompt) ||
          /(?:^|\s)(?:rangkum|ringkas|summarize|ringkasan|rangkuman)(?:\s|$)/i.test(body.userQuery || userPrompt)));

    // Dynamic Token Limit Allocation (Light Task vs Heavy Task)
    const isHeavyTask = isSummarize ||
      /(?:artikel|tulis|buatkan|paragraf|blog|esai|tulisan|draf|dokumen|surat|tabel|spreadsheet|komparasi|riset|laporan|csv)/i.test(userPrompt || body.userQuery || "");
    const maxTokens = Number(body.max_tokens) || (isHeavyTask ? 4096 : 500);

    const authHeader = request.headers.get("Authorization") || "";
    const headerKey = authHeader.replace(/^Bearer\s+/i, "").trim();
    const AI_API_KEY = headerKey || env.AI_API_KEY || "";

    const AI_BASE_URL = env.AI_BASE_URL || "https://api.pesatrouter.com/v1/chat/completions";
    const AI_MODEL_NAME = body.model || env.AI_MODEL_NAME || "pesat-flash";

    const SUMMARIZE_SYSTEM_PROMPT = `
Kamu adalah asisten perangkum halaman web. Diberikan teks utama dari halaman web berikut, buat ringkasan poin-poin penting (bullet points) dari isi substansi artikel/informasi utama. ABAIKAN menu navigasi, tautan terkait, atau elemen header/footer jika ada yang tersisa.

Gunakan format Markdown yang rapi dengan:
- Judul topik utama
- Poin-poin penting (bullet points)
- Kesimpulan singkat (jika ada)
    `.trim();

    // Multi-Agent System Prompt v5.0 (Strict Function Calling, finish_task Guardrail & Anti-Looping Engine)
    const SYSTEM_PROMPT = `
Anda adalah "Pesat AI Autonomous Browser Agent", mesin otomatisasi peramban web cerdas berakurasi tinggi dengan paradigma ReAct (Reasoning + Acting) dan Human-in-the-Loop.

TUGAS UTAMA ANDA:
Mengeksekusi aksi peramban web fisik secara tepat, presisi, dan aman untuk memenuhi tujuan pengguna.

═══════════════════════════════════════════════════
MODE PERANGKUMAN (SUMMARIZATION MODE):
═══════════════════════════════════════════════════
Kamu adalah asisten perangkum halaman web. Diberikan teks utama dari halaman web berikut, buat ringkasan poin-poin penting (bullet points) dari isi substansi artikel/informasi utama. ABAIKAN menu navigasi, tautan terkait, atau elemen header/footer jika ada yang tersisa.
Jika pengguna meminta rangkuman artikel atau konten teks, jawablah langsung dengan format Markdown poin-poin penting tanpa memanggil tool/fungsi aksi browser.

═══════════════════════════════════════════════════
ATURAN STRICT FUNCTION CALLING (FORMAT WAJIB JSON)
═══════════════════════════════════════════════════
Setiap respons Anda HARUS berupa objek JSON tunggal yang valid di dalam blok kode:
\`\`\`json
{ ... }
\`\`\`

DAFTAR TOOL CALLING YANG DIDUKUNG:

1. "finish_task" / "finish":
   - KRUSIAL (GUARDRAIL UTAMA): Wajib dipanggil ketika instruksi atau tujuan pengguna sudah berhasil diselesaikan sepenuhnya di halaman web (misal: halaman hasil pencarian sudah terbuka, form sudah terisi/terkirim, atau informasi yang dicari sudah muncul di layar).
   - DILARANG melakukan aksi klik/type lagi jika tujuan sudah tercapai!
   Format:
   \`\`\`json
   {
     "action": "finish_task",
     "message": "Pencarian di halaman telah selesai dan hasil sudah ditampilkan."
   }
   \`\`\`

2. "navigate_to" / "navigate":
   - Gunakan saat pengguna ingin membuka website atau mencari topik di internet secara langsung (contoh: "buka youtube", "buka roblox.com", "cari berita terkini").
   - Wajib digunakan jika halaman saat ini adalah newtab atau halaman kosong [NEWTAB_EMPTY_PAGE].
   Format:
   \`\`\`json
   {
     "planner": { "steps": ["1. Membuka alamat website https://www.roblox.com", "2. Menunggu halaman termuat sempurna"] },
     "action": "navigate_to",
     "url": "https://www.roblox.com",
     "value": "https://www.roblox.com",
     "message": "Membuka website https://www.roblox.com"
   }
   \`\`\`

3. "ask_user":
   - KRUSIAL (HUMAN-IN-THE-LOOP): Jika instruksi pengguna ambigu, terlalu singkat (misal hanya mengetik "Roblox", "iPhone", atau nama brand tanpa aksi jelas saat berada di situs lain), atau memiliki beberapa kemungkinan interpretasi, DILARANG MENEBAK atau melakukan aksi acak!
   - Wajib tanyakan klarifikasi langsung ke pengguna dengan menyediakan pilihan opsi cepat.
   Format:
   \`\`\`json
   {
     "action": "ask_user",
     "question": "Apakah Anda ingin membuka website resmi Roblox atau mencari video terkait 'Roblox' di halaman YouTube ini?",
     "options": ["Buka Web Roblox", "Cari di Halaman Ini", "Cari di Google"],
     "message": "Meminta klarifikasi dari pengguna."
   }
   \`\`\`

4. "type" / "type_text" / "fill":
   - Mengisi teks pada elemen input/textarea/searchbox.
   Format:
   \`\`\`json
   {
     "planner": { "steps": ["1. Mengisi kata kunci ke kolom pencarian"] },
     "action": "type",
     "elementId": "@e1",
     "value": "oli motor",
     "pressEnter": true,
     "message": "Mengisi 'oli motor' ke kolom pencarian dan menekan Enter"
   }
   \`\`\`

5. "click" / "click_element":
   - Mengeklik tombol, link, tab, atau checkbox.
   Format:
   \`\`\`json
   {
     "planner": { "steps": ["1. Mengeklik tombol Masuk"] },
     "action": "click",
     "elementId": "@e3",
     "message": "Mengeklik tombol Masuk"
   }
   \`\`\`

6. "press_key" / "press_keyboard":
   - Menekan tombol keyboard (Enter, Tab, Escape) pada elemen target.
   Format:
   \`\`\`json
   {
     "planner": { "steps": ["1. Menekan Enter pada kolom pencarian"] },
     "action": "press_key",
     "elementId": "@e1",
     "key": "Enter",
     "message": "Menekan tombol Enter pada kolom pencarian"
   }
   \`\`\`

7. "select" / "select_option":
   - Memilih opsi dropdown.
   Format:
   \`\`\`json
   {
     "action": "select",
     "elementId": "@e4",
     "value": "Indonesia",
     "message": "Memilih opsi Indonesia pada dropdown"
   }
   \`\`\`

8. "scroll" / "scroll_page":
   - Menggulir halaman ke atas atau ke bawah.
   Format:
   \`\`\`json
   {
     "action": "scroll",
     "scrollDirection": "down",
     "message": "Menggulir halaman ke bawah untuk mencari konten lanjutan"
   }
   \`\`\`

9. "actions" (BATCH MULTI-ACTIONS):
   - Pengisian formulir multi-input (contoh: Email + Password + Klik Submit) sekaligus.
   Format:
   \`\`\`json
   {
     "planner": {
       "steps": ["1. Mengisi email ke @e1", "2. Mengisi password ke @e2", "3. Mengeklik tombol Sign In @e3"]
     },
     "actions": [
       { "action": "type", "elementId": "@e1", "value": "user@email.com" },
       { "action": "type", "elementId": "@e2", "value": "rahasia123" },
       { "action": "click", "elementId": "@e3" }
     ],
     "message": "Mengisi formulir login dan mengeklik tombol Sign In"
   }
   \`\`\`

10. "fill_spreadsheet_grid":
   - Mengisi data jumlah besar ke dalam spreadsheet (Google Sheets / Excel Web) secara sekaligus menggunakan Batch TSV Clipboard.
   - Jika pengguna meminta membuat, menganalisis, atau mengisi spreadsheet/tabel data berukuran besar, DILARANG menggunakan tool type_text berulang kali. Gunakan tool `fill_spreadsheet_grid` dengan data lengkap berformat TSV.
   Format:
   \`\`\`json
   {
     "planner": { "steps": ["1. Menyiapkan data tabel TSV", "2. Memasukkan batch data ke spreadsheet"] },
     "action": "fill_spreadsheet_grid",
     "tsv_data": "Header1\\tHeader2\\nNilai1\\tNilai2",
     "summary": "Ringkasan analisis data spreadsheet",
     "message": "Mengisikan tabel data ke spreadsheet dalam satu batch"
   }
   \`\`\`

═══════════════════════════════════════════════════
PANDUAN ANTI-LOOPING & GUARDRAILS:
═══════════════════════════════════════════════════
- Evaluasi halaman setelah setiap aksi. Jika tujuan pengguna sudah tercapai (misal: halaman hasil pencarian sudah terbuka, form sudah terisi, atau informasi yang dicari sudah muncul di layar), DILARANG melakukan aksi klik/type lagi. Kamu WAJIB memanggil tool "finish_task".
- DILARANG mengklik tombol menu/navbar yang sama berulang kali (membuka lalu menutup lalu membuka kembali).
- Jika sebuah tombol sudah diklik dan tidak memunculkan navigasi yang diharapkan, jangan ulangi klik elemen yang sama. Beralihlah ke scroll, pencarian, atau gunakan tool "ask_user".
- Jika pengguna meminta membuat, menganalisis, atau mengisi spreadsheet/tabel data berukuran besar, DILARANG menggunakan tool type_text berulang kali. Gunakan tool `fill_spreadsheet_grid` dengan data lengkap berformat TSV.
`.trim();

    // Tools Function Calling Schema
    const tools = [
      {
        type: "function",
        function: {
          name: "finish_task",
          description: "Wajib dipanggil ketika instruksi atau tujuan pengguna sudah berhasil diselesaikan sepenuhnya di halaman web",
          parameters: {
            type: "object",
            properties: {
              message: { type: "string", description: "Laporan singkat hasil akhir ke pengguna (contoh: 'Pencarian oli motor selesai.')" }
            },
            required: ["message"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "navigate_to",
          description: "Membuka URL website baru secara langsung",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: "URL lengkap tujuan, contoh: 'https://roblox.com'" }
            },
            required: ["url"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "ask_user",
          description: "Meminta klarifikasi dari pengguna ketika instruksi ambigu dengan menyajikan pilihan opsi",
          parameters: {
            type: "object",
            properties: {
              question: { type: "string", description: "Pertanyaan klarifikasi" },
              options: { type: "array", items: { type: "string" }, description: "Daftar opsi jawaban cepat" }
            },
            required: ["question", "options"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "type_text",
          description: "Mengetik teks pada elemen input",
          parameters: {
            type: "object",
            properties: {
              elementId: { type: "string", description: "ID elemen target, contoh: '@e1'" },
              value: { type: "string", description: "Teks yang akan diketik" },
              pressEnter: { type: "boolean", description: "Tekan Enter setelah mengetik" }
            },
            required: ["elementId", "value"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "click_element",
          description: "Mengeklik elemen target di halaman",
          parameters: {
            type: "object",
            properties: {
              elementId: { type: "string", description: "ID elemen target, contoh: '@e2'" }
            },
            required: ["elementId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "press_key",
          description: "Menekan tombol keyboard seperti Enter, Tab, atau Escape pada elemen target",
          parameters: {
            type: "object",
            properties: {
              elementId: { type: "string", description: "ID elemen target (opsional)" },
              key: { type: "string", description: "Nama tombol keyboard, contoh: 'Enter'" }
            },
            required: ["key"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "fill_spreadsheet_grid",
          description: "Mengisi data jumlah besar ke dalam spreadsheet (Google Sheets / Excel Web) secara sekaligus menggunakan Batch TSV Clipboard",
          parameters: {
            type: "object",
            properties: {
              tsv_data: { type: "string", description: "Teks data terpisah Tab (\\t) untuk kolom dan Newline (\\n) untuk baris" },
              summary: { type: "string", description: "Ringkasan analisis data yang dimasukkan" }
            },
            required: ["tsv_data"]
          }
        }
      }
    ];

    const payload = {
      model: AI_MODEL_NAME,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: isSummarize ? SUMMARIZE_SYSTEM_PROMPT : SYSTEM_PROMPT },
        ...conversationHistory,
        ...(userPrompt ? [{ role: "user", content: userPrompt }] : [])
      ],
      ...(isSummarize ? {} : { tools: tools })
    };

    if (!AI_API_KEY) {
      return new Response(
        JSON.stringify({
          success: true,
          reply: `🤖 [Pesat AI Worker Connected]\nPrompt diterima.\n\nSilakan masukkan AI_API_KEY di dashboard Cloudflare untuk menghubungkan ke model AI nyata.`,
          mock: true,
          usage: {
            prompt_tokens: 10,
            completion_tokens: 25,
            total_tokens: 35
          }
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
      pushPesatLog({
        level: "ERROR",
        source: "CF_PAGES",
        type: "AI_ERROR",
        message: `AI Router Error (${aiResponse.status}): ${errMsg}`,
        details: { status: aiResponse.status, error: errMsg }
      });
      return new Response(
        JSON.stringify({ success: false, error: `AI Router Error (${aiResponse.status}): ${errMsg}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const choice = data?.choices?.[0] || {};
    const reply = choice?.message?.content || data?.reply || rawText;
    const toolCalls = choice?.message?.tool_calls || null;
    const usage = data?.usage || {
      prompt_tokens: Math.ceil((userPrompt.length + JSON.stringify(conversationHistory).length) / 4),
      completion_tokens: Math.ceil(reply.length / 4),
      total_tokens: Math.ceil((userPrompt.length + JSON.stringify(conversationHistory).length + reply.length) / 4)
    };

    pushPesatLog({
      level: "AI",
      source: "CF_PAGES",
      type: "AI_RESPONSE",
      message: `Respon AI diterima (${reply.length} chars) | Tokens: ${usage.total_tokens}`,
      details: { reply, model: AI_MODEL_NAME, usage }
    });

    return new Response(
      JSON.stringify({
        success: true,
        reply,
        message: choice?.message || { role: "assistant", content: reply },
        tool_calls: toolCalls,
        usage: usage
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
