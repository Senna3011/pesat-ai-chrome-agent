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

### 🗓️ Day 1 (Inisialisasi & Setup Dasar)
- [x] Diskusi awal dan penentuan strategi tech stack (Vanilla JS + Side Panel).
- [x] Pembuatan dokumen pelacak proyek `coldstart.md`.
- [x] Pembuatan boilerplate Chrome Extension (Manifest V3):
  - `manifest.json`: Konfigurasi permission `sidePanel`, `activeTab`, `scripting`, `storage`.
  - `sidepanel/`: UI antarmuka chat, status visual agent, dan panel log aktivitas.
  - `background.js`: Service worker untuk membuka side panel saat ikon diklik dan routing pesan.
  - `content.js`: Injeksi DOM parser awal dan highlighter elemen aktif.
- [x] Pembuatan template middleware Cloudflare Pages `functions/api/chat.js` dan folder `public/index.html`.
- [x] Panduan instalasi dan pengujian *Load Unpacked* di Google Chrome.
- [x] Fix konfigurasi Cloudflare Pages (Build command dikosongkan, Build output directory: `public`).
