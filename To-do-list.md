# 🚀 TODO & ROADMAP: AI CHROME EXTENSION AGENT

> **Project Goal**: Membangun Chrome Extension (Manifest V3) berbasis AI Browser Automation yang presisi, terintegrasi dengan API AI Internal via Cloudflare Pages (Serverless), serta mengadopsi teknik *browser action/skills* terbaik.
> **Target Mentor**: Pak Nell
> **Status**: In Progress (Single Developer)
> **Infrastructure**: Standalone Ecosystem (Team Email + New GitHub + Cloudflare Pages)

---

## 📌 PHASE 0: Setup Setup Ekosistem Mandiri (Team Email, GitHub, Cloudflare)
*Fokus: Menyiapkan infrastruktur terisolasi agar proyek bersih dan tidak mengganggu VPS/akun lain.*

- [x] **0.1 Setup Akun & Kredensial Proyek**
- [x] **0.2 Setup GitHub Proyek Baru**
  - [x] Repositori `pesat-ai-chrome-agent` terhubung & commit aktif.
  - [x] Push commit berisi file `README.md`, `.gitignore`, dan arsitektur ekstensi.
- [x] **0.3 Setup Cloudflare Worker / Pages**
  - [x] Akun Cloudflare & Worker aktif di `https://pesat-ai-chrome-agent.senna-947.workers.dev/`.
  - [x] Konfigurasi Environment Variables (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_NAME`).

---

## 📌 PHASE 1: Riset & Analisis Technique (DOM & Skills)
*Fokus: Memahami bagaimana AI membaca web dan mengklik tombol secara akurat tanpa error.*

- [x] **1.1 Riset Framework Automation Core**
  - [x] Pelajari mekanisme *auto-waiting* dan pemilihan selector.
- [x] **1.2 Bedah Repositori Open-Source AI Agent (Nanobrowser, Browser-Use, Stagehand)**
  - [x] Analisis arsitektur DOM-parsing (Reduced DOM / Viewport filtering).
  - [x] Evaluasi antarmuka dan Multi-Agent Pipeline (**Planner, Navigator, Validator**) ala **Nanobrowser**.
  - [x] Adopsi **Colored Bounding Box** untuk penandaan elemen web interaktif.
- [x] **1.3 Pemetaan Skill (`skills.sh`) & Internal API**
  - [x] Skema JSON `tools` & Multi-Agent output (`planner`, `action`, `elementId`, `value`).
  - [x] Uji coba panggilan API AI internal (`pesat-flash` via PesatRouter) sukses 100%.

---

## 📌 PHASE 2: Setup Environment & Boilerplate (Extension + Worker)
*Fokus: Menyiapkan struktur dasar Chrome Extension Manifest V3 dan API Proxy di Cloudflare.*

- [x] **2.1 Inisialisasi Struktur Proyek Chrome Extension**
  - [x] Buat folder proyek `extension/`.
  - [x] Buat file `manifest.json` dengan permission wajib (`activeTab`, `scripting`, `storage`, `sidePanel`).
  - [x] Buat file utama: `background.js`, `content.js`, `sidepanel/sidepanel.html`, `sidepanel.js`.
  - [x] Load unpacked ekstensi ke Chrome (`chrome://extensions/`) terverifikasi aktif.
- [x] **2.2 Setup API Middleware di Cloudflare Worker / Pages**
  - [x] Buat entrypoint `index.js` & `functions/api/chat.js` (Proxy request aman ke AI internal).
  - [x] Set `Environment Variables` di dashboard Cloudflare Worker.

---

## 📌 PHASE 3: Integrasi Engine AI & Otomatisasi DOM (Multi-Agent Supercharged)
*Fokus: Menghubungkan logika berpikir LLM dengan eksekusi fisik pada halaman web.*

- [x] **3.1 Integrasi Extension ke Cloudflare Worker Endpoint**
  - [x] Konfigurasi `sidepanel.js` & `background.js` memanggil URL endpoint Worker secara live.
  - [x] Susun *Multi-Agent System Prompt* di Worker (Planner, Navigator, Validator).
- [x] **3.2 Pembuatan DOM Parser Canggih (`content.js`)**
  - [x] Pindai elemen interaktif dengan sistem filter Viewport (hemat 85% token).
  - [x] **Colored Bounding Box & Numbered Badges** (Biru untuk input, Merah untuk button, Hijau untuk link, dll.).
- [x] **3.3 Pembuatan Action Executor & Fitur Unggulan UX**
  - [x] Handler aksi `click`, `type` (dengan submit enter), `scroll`, `navigate`.
  - [x] **Multi-Agent Pipeline Cards** (Visual kartu 🧠 Planner, 🧭 Navigator, 🎯 Validator).
  - [x] **Rich Markdown & Table Renderer** (Teks tebal, bullet list, dan tabel HTML bersih).
  - [x] **Fitur Edit Prompt & Re-run** (Koreksi instruksi lama tanpa spam).
  - [x] **New Chat (+)** & **Session History Manager (Drawer)**.
  - [x] **Quick Action Chips** & **Emergency Stop Button (⏹️)**.

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