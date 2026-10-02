# ROADMAP & FASE PENGERJAAN: PESAT AI TO AITOPIA-GRADE BENCHMARK

Target: Menyamai kemampuan dan kenyamanan pengguna ekstensi **AITOPIA** (AI Sidebar, Multi-Model, Web Assistant) dalam arsitektur Chrome Extension MV3 murni.

---

## 📌 Phase 1: Latency & Streaming Response (Real-Time Experience)
*Tujuan: Menghilangkan jeda tunggu respons AI; teks muncul mengalir instan.*

- [x] **1.1 SSE (Server-Sent Events) Streaming Reader**
  - Implementasikan `ReadableStream` parser pada `callLLM` di `sidepanel/sidepanel.js` dan `api-client.js`.
  - Tampilkan token kata per kata secara realtime saat LLM menghasilkan jawaban.
- [x] **1.2 Incremental Markdown & Table Formatter**
  - Render parsing markdown secara streaming tanpa merusak tag HTML terbuka.
  - Tabel dan codeblock tetap rapi saat proses ketik sedang berjalan.
- [x] **1.3 Instant Stop Control**
  - Hubungkan tombol Stop langsung dengan `AbortController.abort()` untuk memutus koneksi streaming seketika.

---

## 📌 Phase 2: In-Page Quick Assistance (Zero-Friction UX)
*Tujuan: Interaksi langsung di atas halaman web tanpa wajib membuka sidepanel.*

- [x] **2.1 Floating Text Selection Toolbar (`content.js`)**
  - Deteksi event `selectionchange` / `mouseup` saat pengguna memblok teks artikel/web.
  - Tampilkan floating bar kecil dengan tombol cepat: `[📖 Rangkum]`, `[🌐 Terjemahkan]`, `[💡 Jelaskan]`, `[✏️ Perbaiki Teks]`.
  - Hasil muncul dalam floating popover ringan di dekat kursor mouse.
- [x] **2.2 Native Chrome Context Menus (`background.js`)**
  - Daftarkan menu klik kanan:
    - Seleksi teks: "Tanyakan Pesat AI", "Rangkum Teks Ini".
    - Gambar: "Jelaskan Gambar Ini (Vision OCR)".
    - Link: "Baca & Rangkum Isi Link".
  - Kirim hasil otomatis ke Sidepanel atau tampilkan popover.
- [x] **2.3 Floating Action Button (FAB) Toggle**
  - Ikon mini melayang opsional di pojok kanan bawah halaman web untuk membuka/tutup sidepanel via 1 klik.

---

## 📌 Phase 3: Search Engine Copilot (Inline Injection)
*Tujuan: Menampilkan jawaban AI langsung berdampingan di halaman pencarian.*

- [x] **3.1 Search Query Interceptor**
  - Deteksi URL pencarian: `google.com/search`, `bing.com/search`, `duckduckgo.com`.
  - Ekstrak parameter query `q` dari URL secara otomatis.
- [x] **3.2 Right-Rail AI Card Injection**
  - Injeksi panel respons AI di kolom sebelah kanan halaman hasil pencarian.
  - Gunakan Shadow DOM agar style ekstensi tidak bentrok dengan CSS Google/Bing.
  - Tambahkan tombol: `Salin Jawaban`, `Lanjutkan di Sidepanel`.

---

## 📌 Phase 4: High-Efficiency DOM Parsing & Tab Context
*Tujuan: Baca web secepat kilat dengan penghematan token hingga 70%.*

- [x] **4.1 Readability Article Extractor**
  - Terapkan algoritma Reader View di `content.js` untuk mengekstrak teks utama artikel.
  - Otomatis membuang tag `<script>`, `<style>`, `<iframe>`, navigasi header, footer, dan iklan banner.
- [x] **4.2 Multi-Tab Cross-Referencing**
  - Dukungan perbandingan data antar-tab yang sedang dibuka pengguna secara instan.
- [x] **4.3 YouTube Video Summary Generator**
  - Deteksi saat membuka `youtube.com/watch`.
  - Ambil subtitle/transkrip video via API/DOM dan buat rangkuman bab/poin utama video.

---

## 📌 Phase 5: Client-Side Document Processor (No-Cloud Parsing)
*Tujuan: Mampu menganalisis PDF, DOCX, XLSX secara lokal langsung di peramban.*

- [x] **5.1 In-Browser PDF Parser**
  - Pasang engine ekstraksi PDF berbasis client-side untuk membaca teks dan tabel dokumen.
- [x] **5.2 Spreadsheet & Word Converter**
  - Konversi file `.xlsx`, `.csv`, `.docx` yang dilampirkan menjadi format markdown terstruktur sebelum dikirim ke LLM.
- [x] **5.3 Export Ready Artifacts**
  - Unduh tabel hasil riset langsung ke format Excel `.xlsx` dan draf tulisan ke `.docx` via 1 tombol.

---

## 📌 Phase 6: Multi-Model Hub & Model Switcher (BYOK Aggregator)
*Tujuan: Pengguna bebas memilih model terbaik sesuai kebutuhan kecepatan vs kecerdasan.*

- [x] **6.1 Unified Multi-Provider API Adapter**
  - Dukungan payload kompatibel untuk:
    - PesatRouter (Default Cloud)
    - OpenAI Official (GPT-4o, GPT-4o-mini)
    - Google Gemini (Gemini 2.5 Pro, Flash)
    - Anthropic Claude (Claude 3.5 Sonnet)
    - DeepSeek (V3, R1)
- [x] **6.2 Quick Model Switcher Pill**
  - Pilihan model instan di atas composer sidepanel dengan indikator latency & cost.

---

## 📌 Standar QA & Acceptance Criteria
Setiap fase wajib memenuhi kriteria:
1. **Zero Console Error**: Bersih dari uncaught runtime exceptions di sidepanel maupun content script.
2. **WCAG Compliance**: Font minimal 14px, palet slate sejuk, kontras tinggi.
3. **Playwright Regression Test Suite**: Menjaga 100% tes lolos sebelum rilis fase baru.
