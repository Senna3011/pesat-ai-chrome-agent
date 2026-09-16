# 📘 PROJECT LOG & COLDSTART: AI CHROME EXTENSION AGENT

> **Dokumen ini dibuat untuk melacak progres, keputusan arsitektur, dan konteks teknis proyek secara berkelanjutan.**

---

## 📌 Ringkasan Proyek
* **Nama Proyek**: AI Chrome Extension Agent (Nanobrowser-inspired)
* **Tujuan**: Membangun ekstensi browser berbasis Chrome Extension Manifest V3 dengan Side Panel UI yang mampu melakukan browser automation (membaca DOM, mengeksekusi aksi web, mengisi formulir) menggunakan AI/LLM internal.
* **Tech Stack Ekstensi**: Vanilla HTML, CSS, JavaScript (Ringan, mudah dipahami, tanpa build tools).
* **Infrastruktur API**: Cloudflare Pages Functions (Serverless Proxy Middleware untuk mengamankan API Key AI Internal).
* **Target Mentor**: Pak Nell

---

## 🌟 Visi Produk & Keunggulan vs Nanobrowser
1. **✏️ Fitur Edit Prompt & Re-run (Branching/Correction)**: Kemampuan mengedit instruksi yang sudah dikirim sebelumnya, otomatis memotong memori percakapan lama yang salah dan menjalankan ulang tanpa spamming chat.
2. **➕ New Chat Context (+ Button)**: Tombol instan untuk membuka sesi baru dengan konteks bersih.
3. **📜 Session History Manager (Drawer)**: Riwayat percakapan yang tersimpan secara lokal dan persisten.
4. **User-Centric Step Timeline**: Menampilkan pemikiran (*thought*) dan aksi (*action*) AI secara visual dan elegan.
5. **1-Click Quick Action Chips**: Memudahkan user dengan tombol instan (Rangkum Web, Ekstrak Tabel Data, Isi Form Otomatis).
6. **Smart Reduced DOM Parser**: Mengompresi DOM hingga 85% lebih hemat token dibanding Nanobrowser standar.
7. **Emergency Stop Button (⏹️)**: Kontrol penuh bagi pengguna untuk menghentikan automasi kapan saja.

---

## 🏗️ Arsitektur Sistem

```
┌────────────────────────────────────────────────────────┐
│                     CHROME BROWSER                     │
│                                                        │
│  ┌───────────────────────┐    ┌──────────────────────┐ │
│  │   Side Panel (UI)     │◄──►│ Background Worker    │ │
│  │  (Chat, Status, Log)  │    │  (Network & Routing) │ │
│  └───────────────────────┘    └──────────┬───────────┘ │
│                                          │             │
│                                          ▼             │
│                               ┌──────────────────────┐ │
│                               │ Content Script       │ │
│                               │ (DOM Reader & Action)│ │
│                               └──────────────────────┘ │
└──────────────────────────────────────────┬─────────────┘
                                           │
                                           ▼ (HTTPS Fetch)
                    ┌────────────────────────────────────────────┐
                    │          CLOUDFLARE PAGES PROXY            │
                    │        `functions/api/chat.js`             │
                    │   (Menyimpan API Key Internal Aman)        │
                    └──────────────────────┬─────────────────────┘
                                           │
                                           ▼
                    ┌────────────────────────────────────────────┐
                    │             INTERNAL AI API                │
                    │          (Model LLM Perusahaan)            │
                    └────────────────────────────────────────────┘
```

---

## 📝 Log Progres Harian

### 🗓️ Day 1 (Inisialisasi Dasar, Backend AI, & Phase 3 Multi-Agent Supercharged)
- [x] Diskusi awal dan penentuan strategi tech stack (Vanilla JS + Side Panel).
- [x] Pembuatan dokumen pelacak proyek `coldstart.md` dan roadmap `To-do-list.md`.
- [x] Pembuatan boilerplate Chrome Extension (Manifest V3) dan integrasi Cloudflare Worker.
- [x] **Smart DOM Scanner & Colored Bounding Box Overlay** (`content.js`): Garis kotak berwarna (Biru: Input, Merah: Button, Hijau: Link, Oranye: Select) dan badge angka presisi ala Nanobrowser.
- [x] **Multi-Agent Pipeline Cards**: Visualisasi transparan kartu 🧠 **Planner** (daftar rencana), 🧭 **Navigator** (aksi target [ID]), dan 🎯 **Validator** (verifikasi hasil).
- [x] **Rich Markdown & Table Renderer**: Format Markdown (bold, list, table, code) ter-render bersih dalam HTML.
- [x] **Multi-Action Executor** (`content.js`): Simulasi otomatis klik, ketik teks dengan submit enter, scroll, dan navigasi URL.
- [x] **Fitur Edit Prompt & Re-run**: Kemampuan koreksi prompt lama pada bubble chat dengan auto-truncation memori percakapan.
- [x] **New Chat Context (+)**: Tombol instan untuk reset obrolan dan memulai task baru.
- [x] **Session History Manager (Drawer)**: Riwayat percakapan persisten (`chrome.storage.local`).
- [x] **Quick Action Chips**: Tombol 1-klik untuk Rangkum Web, Ekstrak Data/Tabel, Bantu Isi Form, dan Toggle Marker.
- [x] **Emergency Stop Button (⏹️)**: Kontrol pembatalan aksi seketika bagi pengguna.
- [x] **Autonomous System Prompt**: Engine AI (`index.js`) yang cerdas membedakan percakapan informatif vs JSON Action otomatis.

	### 🗓️ Day 2 (Phase 4: Error Handling, UI Redesign Pesat.ai, Zero-Config Free Tier, & Anti-Looping)
	- [x] **Autonomous Multi-Step Agentic Loop** (`sidepanel.js`): Agen secara cerdas menjalankan tugas multi-langkah berturut-turut hingga selesai (`action: finish`) atau dihentikan manual oleh user via Emergency Stop.
	- [x] **Auto-Waiting `waitForDOMStable()`** (`content.js`): MutationObserver yang memantau stabilitas DOM hingga 5 detik setelah navigasi.
	- [x] **Direct Chrome Tabs API Navigation** (`background.js`): Membuka URL langsung lewat `chrome.tabs.update()`, mencegah error akses tab baru.
	- [x] **Fuzzy Fallback Matching** (`content.js`): Sistem pencarian elemen berbasis teks/placeholder jika ID tidak ditemukan.
	- [x] **Redesign UI & Pesat.ai Design System** (`sidepanel.css`, `sidepanel.html`):
	  - Font resmi **Sora** (headings) & **Plus Jakarta Sans** (body).
	  - Base minimum font size **14px** (chat bubble 13.8px, input textarea **16px**).
	  - Area input prompt diperbesar (tinggi default **80px**, max **180px**) untuk kenyamanan mengetik instruksi panjang.
	  - Palette Obsidian `#0a0a14` dengan *ambient aurora glow* violet/indigo & *pill-style chips*.
	- [x] **Zero-Config Free Tier Quota (40 Permintaan / Hari)**:
	  - Pengguna langsung dapat menggunakan otomatisasi tanpa wajib input API Key di awal.
	  - Batas kuota gratis lokal 40 permintaan/hari dengan opsi Custom API Key di menu ⚙️ Pengaturan untuk penggunaan tanpa batas.
	- [x] **Autonomous Heuristic Fallback Engine** (`index.js`, `functions/api/chat.js`):
	  - Menyediakan penanganan otonom untuk navigasi, perangkuman konten, ekstraksi data, dan pengisian formulir.
	- [x] **Fix Anti-Looping Navigasi**:
	  - *Single-intent auto-termination*: Menghentikan loop secara langsung setelah navigasi selesai.
	  - *Current-URL awareness*: Mencegah AI mengeksekusi navigasi ulang jika URL sudah terbuka di tab aktif.
	- [x] **Pengujian & Verifikasi Pengguna**: Uji coba instalasi dan automasi browser di lingkungan eksternal berhasil berjalan lancar dan aman.

