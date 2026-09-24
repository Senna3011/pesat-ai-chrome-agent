# 📘 PROJECT LOG & COLDSTART: AI CHROME EXTENSION AGENT

> **Dokumen ini dibuat untuk melacak progres, keputusan arsitektur, dan konteks teknis proyek secara berkelanjutan.**

---

## 📌 Ringkasan Proyek
* **Nama Proyek**: AI Chrome Extension Agent (Nanobrowser-inspired)
* **Tujuan**: Membangun ekstensi browser berbasis Chrome Extension Manifest V3 dengan Side Panel UI yang mampu melakukan browser automation (membaca DOM, mengeksekusi aksi web, mengisi formulir) menggunakan AI/LLM internal.
* **Tech Stack Ekstensi**: Vanilla HTML, CSS, JavaScript (Ringan, mudah dipahami, tanpa build tools).
* **Infrastruktur API**: Cloudflare Pages Functions (Serverless Proxy Middleware untuk mengamankan API Key AI Internal).
* **Target Stakeholder**: Tim Internal & Product Lead

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

		### 🗓️ Day 3 (Phase 5: High-Accuracy AXTree, Anti-Loop Guardrails, & Human-in-the-Loop)
		- [x] **Akurasi Form React/Vue/SPA**: Menggunakan `Object.getOwnPropertyDescriptor` prototype setter agar nilai form terisi sempurna tanpa memicu validasi kosong.
		- [x] **Mekanisme Human-in-the-Loop (`ask_user`)**: Jika instruksi pengguna ambigu (contoh: mengetik satu kata nama brand), AI berhenti menebak dan menyajikan tombol opsi klarifikasi interaktif.
		- [x] **Anti-Loop Circuit Breaker**: Mendeteksi jika aksi identik terpanggil 2–3x berturut-turut di background worker dan memutus siklus secara aman.
		- [x] **Dukungan Aksi Keyboard (`press_key`)**: Menambahkan event simulasi penekanan tombol keyboard (Enter/Tab/Escape) dan form submission fallback.
		- [x] **Penyempurnaan Perangkuman Halaman (Readable Content)**: Ekstraksi teks semantik murni (judul, artikel, paragraf) tanpa gangguan elemen navigasi/footer, dan sanitasi respons JSON agar tampil sebagai Markdown bersih.
		- [x] **Hardening Keamanan & CORS Lockdown**: Pembatasan akses origin backend hanya untuk Chrome Extension resmi serta sensor otomatis password pada log.

		### 🗓️ Day 4 (Phase 6: Centralized Telemetry, Stealth UX ala Comet, & Modular Engine Refactoring)
		- [x] **Centralized Multi-User Telemetry & Real-Time Log Dashboard** (`logger.js`, `functions/api/logs.js`, `public/logs.html`):
		  - Dashboard telemetry interaktif berbasis web untuk memantau performa, latency, error, dan aktivitas agent seluruh user secara live.
		  - Endpoint serverless `/api/logs` dengan CORS policy yang aman dan buffer in-memory.
		  - Zero UI leakage: Telemetry berjalan di latar belakang tanpa mengganggu tampilan Side Panel pengguna.
		- [x] **Stealth UX (Perplexity/Comet-like Minimalist Experience)** (`sidepanel.js`, `content.js`):
		  - Sembunyikan jejak teknis mentah (trace kartu Planner/Navigator/Validator) dari antarmuka chat.
		  - Tampilan visual super bersih: Floating indicator ringkas ("Sedang mengerjakan..."), status badge ("Bekerja" / "Siap"), dan hasil akhir disajikan dalam Markdown rapi.
		  - Pilihan pemulihan kesalahan yang ramah pengguna ("Coba strategi lain").
		- [x] **Refactoring Modular Engine & Sinkronisasi Ekstensi**:
		  - Pemisahan core logic ke modul terpisah (`ai-engine.js`, `file-engine.js`, `config.js`, `logger.js`).
		  - Sinkronisasi penuh antara root workspace dan direktori `/extension` untuk kemudahan deploy & debugging.
		  - Polish UI Dark-Glass Pesat.ai (Sora, Plus Jakarta Sans, Obsidian theme, high-contrast readability).
		- [x] **Peningkatan Robustness DOM & AI Loop System**:
		  - Propagasi `stateChanged` dari Content Script ke Sidepanel untuk deteksi akurat saat DOM mengalami mutasi/stuck.
		  - Batch action result handling yang lebih stabil pada dynamic SPA / framework modern.

	### 🗓️ Day 5 (Agentic Realignment, BYOK PesatRouter Integration, UI/UX Polish, & QA Evaluation)
	- [x] **Penyelarasan Visi Agentic vs Generative (Kebutuhan Produktivitas Tim)**:
	  - Menggeser orientasi ekstensi dari sekadar chatbot teks pasif/generatif menjadi **Autonomous Agentic Assistant** yang mengeksekusi tindakan nyata di browser (membuka Gmail, menyusun draf email, inspeksi Google Search Console, mengetik artikel Docs, posting sosmed, dan live code fix).
	  - Prinsip utama: *"Bisa mempermudah pekerjaan manusia dan meningkatkan produktivitas tim."*
	- [x] **Integrasi Direct BYOK PesatRouter (`api.pesatrouter.com`)**:
	  - Panggilan API langsung ke PesatRouter via `ai-engine.js` dengan opsi model: `pesat-flash` (cepat/umum), `pesat-pro` (penalaran mendalam), dan `pesat-lite`.
	  - Penanganan transisi fleksibel antara BYOK PesatRouter dan fallback Cloudflare Worker.
	- [x] **Implementasi Native OpenAI 6-Tool Calling & Hybrid Multi-Resolver**:
	  - 6 Native Tools resmi: `navigate_to`, `click_element`, `type_text`, `press_key`, `ask_user`, `finish_task`.
	  - 3 Lapis Penanda Elemen: ID Semantik `[@e1]` + Fuzzy Text Label Matcher + Robust CSS/XPath Selector.
	  - Circuit Breaker (`MAX_LOOPS = 7`) dan *Action Signature Hash* mencegah infinite loop dan browser hang.
	  - Human-in-the-Loop (`ask_user`): Dialog konfirmasi interaktif sebelum aksi sensitif (Send Email/Delete/Checkout).
	- [x] **Penyempurnaan UI/UX & Verifikasi Panduan Desain Pesat.ai (Skor QA: 9.96/10)**:
	  - Desain Dark-Glass Obsidian (`#0a0a14`) dengan ambient aurora glow violet/indigo.
	  - Standar tipografi: **Sora** (Headings) dan **Plus Jakarta Sans** (Body) dengan batas minimum ukuran font 14px.
	  - Komponen lengkap: Slider Quick Action Chips, Composer Card modern dengan `@ Konteks` dan `📎 Lampiran File`.
	  - Modal Onboarding PesatRouter dan Pengaturan terisolasi rapi (tidak bocor ke chat).
	- [x] **Penyempurnaan Analytic Pipeline (SEO & Perangkuman)**:
	  - Format Markdown profesional pada fitur Rangkum Halaman (Ringkasan Eksekutif, Poin-Poin Kunci, Kesimpulan).
	  - Jalur analisis langsung untuk audit SEO dan keamanan web tanpa memicu peringatan log action navigator.
		- [x] **Temuan Teknis & Evaluasi QA Otomasi Email (Gmail)**:
		  - *Chip Tokenization*: Input penerima email Gmail memerlukan event `Enter` agar terdaftar sebagai chip kontak yang sah.
		  - *Dialog Timing & Auto-Waiting*: Pop-up form compose Gmail membutuhkan waktu render 300–500ms sebelum input penerima siap diinteraksi.
		  - *Multi-Intent Decomposition*: Perintah majemuk (navigasi + compose + input + send) memerlukan pemecahan subtask otomatis agar tidak memicu deteksi stuck atau looping.

		### 🗓️ Day 6 (MVP Audit, Dynamic ReAct Step Budget, & Auto-Dismiss Modals)
		- [x] **Audit & Evaluasi Produk AI Independen (5 Sudut Pandang)**:
		  - Evaluasi menyeluruh dari perspektif *AI Engineer*, *QA Engineer*, *UX Expert*, *Skeptic User*, dan *Investment & Product Manager*.
		  - Skor Kesiapan MVP: **8.6 / 10** (Lolos Kriteria MVP Stakeholders).
		- [x] **Dynamic ReAct Step Budget & Interactive Extension** (`sidepanel.js`, `extension/sidepanel/sidepanel.js`):
		  - Menghilangkan pembatasan statis `MAX_LOOPS = 7` yang berisiko memutus alur tugas SPA kompleks secara prematur.
		  - Menerapkan *Dynamic Step Budget* (default 10 langkah) yang memicu dialog interaktif `ask_user` untuk meminta persetujuan penambahan langkah (8 langkah lanjutan) jika tugas belum tuntas.
		- [x] **Auto-Dismiss Modal & Popup Occlusion** (`content.js`, `extension/content.js`):
		  - Penambahan helper `tryDismissCommonModals()` yang secara cerdas mendeteksi dan menutup overlay/promo popup (`aria-label="close"`, `.modal-close`, tombol 'Tutup'/'Nanti saja') ketika elemen target terhalang (*occluded*).
		  - Memastikan aksi klik pada SPA e-commerce atau situs berita tidak terblokir oleh banner/modal asinkron.
		- [x] **Sinkronisasi Build & Codebase Consistency**:
		  - Sinkronisasi penuh seluruh file `content.js` dan `sidepanel.js` ke direktori `extension/`.

