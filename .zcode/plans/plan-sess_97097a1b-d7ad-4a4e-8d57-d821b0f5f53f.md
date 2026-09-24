# 🚀 Rencana Eksekusi Final: Hybrid Tool Calling & UX-Grade Agentic System (Target Skor 10/10)

## 📌 1. Tujuan Utama
Mentransformasikan Pesat AI Browser Agent menjadi **Autonomous Agentic Workflow Assistant** berstandar industri dengan:
1. **Dual-Intent Engine**: Otomatis membedakan Q&A/Analisis teks (respon langsung Markdown elegan) vs Aksi fisik peramban (Tool Calling).
2. **Native Tool Calling (`tools: [...]`)**: Menggunakan skema resmi OpenAI Tools yang kompatibel penuh dengan PesatRouter (`pesat-flash`, `pesat-pro`).
3. **Hybrid Multi-Resolver (`@e1` + Fuzzy Text + CSS/XPath)**: Menjamin klik dan ketik 100% tepat sasaran di SPA dinamis (Gmail, Tokopedia, Google Docs, CMS).
4. **Human-in-the-Loop (`ask_user`)**: Kartu dialog konfirmasi interaktif sebelum melakukan tindakan sensitif (kirim email, publish, checkout).
5. **Circuit Breaker Anti-Looping**: Limit `MAX_LOOPS = 7` dan *Action Signature Hash* mencegah macet atau hanging.

---

## 🛠️ 2. Langkah-Langkah Pengerjaan

### Langkah 1: Peningkatan Engine AI (`ai-engine.js`)
* Menerapkan skema 6 Native Tools: `navigate_to`, `click_element`, `type_text`, `press_key`, `ask_user`, `finish_task`.
* Mendukung routing otomatis PesatRouter BYOK (`https://api.pesatrouter.com/v1`) dan Cloudflare Worker fallback.

### Langkah 2: Dispatcher ReAct & Kartu UX Interaktif (`sidepanel.js`)
* Mengintegrasikan eksekusi tool calling berulang (loop ReAct hingga maksimal 7 langkah).
* Merender kartu interaktif `ask_user` di layar chat dengan tombol opsi cepat (*Quick Option Chips*).
* Memastikan respon informasional (seperti *"ini platform apa?"*, draf artikel, audit SEO) disajikan langsung dalam Markdown rapi tanpa delay.

### Langkah 3: Multi-Resolver & Event Simulator di Web Page (`content.js`)
* Penanganan `click_element` dengan koordinat nyata Google Wiz/jsaction + fallback text fuzzy.
* Penanganan `type_text` & `press_key` untuk tokenisasi input email Gmail (`Enter`) dan editor contenteditable.

### Langkah 4: Sinkronisasi Workspace & QA Verifikasi
* Menyelaraskan seluruh file antara direktori root dan `/extension`.
* Menjalankan automated test runner untuk validasi sintaksis, DOM mapping, dan Manifest V3.
* Memperbarui dokumentasi `coldstart.md`.