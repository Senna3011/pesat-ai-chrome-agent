# 🚀 TODO & ROADMAP: AI CHROME EXTENSION AGENT

> **Project Goal**: Membangun Chrome Extension (Manifest V3) berbasis AI Browser Automation yang presisi, terintegrasi dengan API AI Internal via Cloudflare Pages (Serverless), serta mengadopsi teknik *browser action/skills* terbaik.
> **Target Mentor**: Pak Nell
> **Status**: In Progress (Single Developer)
> **Infrastructure**: Standalone Ecosystem (Team Email + New GitHub + Cloudflare Pages)

---

## 📌 PHASE 0: Setup Setup Ekosistem Mandiri (Team Email, GitHub, Cloudflare)
*Fokus: Menyiapkan infrastruktur terisolasi agar proyek bersih dan tidak mengganggu VPS/akun lain.*

- [ ] **0.1 Buat Team Email (Email Proyek Baru)**
  - [ ] Buat 1 alamat email dedicated (misal: `project.aiagent@gmail.com`).
  - [ ] Simpan kredensial email di password manager/catatan aman.
- [ ] **0.2 Setup GitHub Proyek Baru**
  - [ ] Mendaftar akun/Organization GitHub baru menggunakan **Team Email**.
  - [ ] Buat repositori baru (misal: `ai-browser-extension`).
  - [ ] Push *initial commit* berisi file `README.md` dan `TODO-AI-EXTENSION.md`.
- [ ] **0.3 Setup Cloudflare Pages**
  - [ ] Mendaftar akun Cloudflare baru menggunakan **Team Email**.
  - [ ] Hubungkan Cloudflare Pages dengan repositori GitHub proyek yang baru dibuat.
  - [ ] Konfigurasi deployment otomatis (Continuous Deployment pada branch `main`).

---

## 📌 PHASE 1: Riset & Analisis Technique (DOM & Skills)
*Fokus: Memahami bagaimana AI membaca web dan mengklik tombol secara akurat tanpa error.*

- [ ] **1.1 Riset Framework Automation Core**
  - [ ] Pelajari mekanisme *auto-waiting* dan pemilihan selector pada **Playwright**.
  - [ ] Pelajari kontrol *low-level* Chrome DevTools Protocol (CDP) pada **Puppeteer**.
- [ ] **1.2 Bedah Repositori Open-Source AI Agent**
  - [ ] Analisis arsitektur DOM-parsing pada repositori `browser-use`.
  - [ ] Pelajari pemetaan 3 fungsi utama (`observe`, `act`, `extract`) pada **Stagehand**.
  - [ ] Evaluasi antarmuka dan penanganan prompt pada **Nanobrowser**.
- [ ] **1.3 Pemetaan Skill (`skills.sh`) & Internal API**
  - [ ] Kumpulkan skema JSON `tools` (function calling) untuk otomatisasi browser (misal: `click_element`, `fill_input`, `scrape_data`).
  - [ ] Uji coba panggilan API AI internal menggunakan skema `tools` tersebut di Postman/cURL.

---

## 📌 PHASE 2: Setup Environment & Boilerplate (Extension + Pages Functions)
*Fokus: Menyiapkan struktur dasar Chrome Extension Manifest V3 dan API Proxy di Cloudflare Pages.*

- [x] **2.1 Inisialisasi Struktur Proyek Chrome Extension**
  - [x] Buat folder proyek `extension/`.
  - [x] Buat file `manifest.json` dengan permission wajib (`activeTab`, `scripting`, `storage`, `sidePanel`).
  - [x] Buat file utama: `background.js`, `content.js`, `sidepanel/sidepanel.html`, `sidepanel.js`.
  - [ ] Load unpacked ekstensi ke Chrome (`chrome://extensions/`) untuk verifikasi awal.
- [ ] **2.2 Setup API Middleware di Cloudflare Pages Functions**
  - [x] Buat folder `/functions/api/` di dalam repositori.
  - [x] Buat endpoint `chat.js` (Pages Function) untuk memproduksi proxy request aman dari Extension ke API AI Internal.
  - [ ] Set `Environment Variables` (API Key & Base URL AI Internal) di dashboard Cloudflare Pages.

---

## 📌 PHASE 3: Integrasi Engine AI & Otomatisasi DOM
*Fokus: Menghubungkan logika berpikir LLM dengan eksekusi fisik pada halaman web.*

- [x] **3.1 Integrasi Extension ke Cloudflare Pages / Worker Endpoint**
  - [x] Konfigurasi `sidepanel.js` & `background.js` agar memanggil URL endpoint Worker.
  - [x] Susun *System Prompt* cerdas di Worker agar LLM merespons percakapan alami atau **JSON Action** otomatis.
- [x] **3.2 Pembuatan DOM Parser (Skrip `content.js`)**
  - [x] Tulis fungsi pemindai elemen interaktif (`<button>`, `<a>`, `<input>`, `<form>`).
  - [x] Bersihkan tag HTML menjadi format ringkas (Reduced DOM / Viewport filter) untuk menghemat 85% token API.
  - [x] Beri marker/ID sementara pada elemen aktif di layar dengan visual badge overlay.
- [x] **3.3 Pembuatan Action Executor & Fitur Unggulan UX**
  - [x] Tulis handler aksi `click`, `type`, `scroll`, `navigate`, dan `extract`.
  - [x] Implementasi fitur **Edit Prompt & Re-run** (koreksi pesan lama tanpa spam).
  - [x] Implementasi **New Chat (+)** & **Session History Manager (Drawer)**.
  - [x] Implementasi **Quick Action Chips** (Rangkum, Ekstrak Data, Bantu Form).
  - [x] Implementasi **Emergency Stop Button (⏹️)**.

---

## 📌 PHASE 4: Handling Error & Pengujian Akurasi
*Fokus: Memastikan AI tidak salah klik dan tahan terhadap jeda loading web.*

- [ ] **4.1 Implementasi Auto-Waiting & Delay**
  - [ ] Tambahkan logika penanganan *loading* (tunggu hingga `DOM content loaded` sebelum AI mengeksekusi aksi berikutnya).
- [ ] **4.2 Uji Coba Skenario Dasar (PoC)**
  - [ ] **Test Case 1**: "Buka Google, ketik 'Kanban CRM', lalu klik cari."
  - [ ] **Test Case 2**: "Isi formulir login sederhana secara otomatis."
  - [ ] **Test Case 3**: "Ambil daftar judul artikel dari web berita."
- [ ] **4.3 Evaluasi & Refactoring Prompt**
  - [ ] Perbaiki *System Prompt* jika AI mengalami kecenderungan *hallucination* selector.

---

## 📌 PHASE 5: Dokumentasi & Pelaporan Mentor
*Fokus: Menyusun laporan progres kerja ke Pak Nell.*

- [ ] **5.1 Penyusunan Ringkasan Teknikal**
  - [ ] Rangkum library yang diadopsi (Playwright, Stagehand, skills.sh).
  - [ ] Dokumentasikan skema arsitektur data: `Extension Popup` $\rightarrow$ `Background Worker` $\rightarrow$ `Cloudflare Pages (API Proxy)` $\rightarrow$ `Internal AI API` $\rightarrow$ `Content Script (DOM Action)`.
- [ ] **5.2 Demo Proof-of-Concept (PoC)**
  - [ ] Tunjukkan hasil *Continuous Deployment* via Cloudflare Pages dan demonstrasi eksekusi otomatisasi browser di depan mentor.