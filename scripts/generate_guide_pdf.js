const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const guideHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Buku Petunjuk Operasional Resmi: Pesat AI Browser Agent</title>
  <style>
    @page {
      size: A4;
      margin: 10mm 14mm 12mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 0;
      line-height: 1.4;
      font-size: 11.5px;
    }
    .page {
      page-break-after: always;
      height: 275mm;
      max-height: 275mm;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .page:last-child {
      page-break-after: avoid;
    }
    .page-content {
      flex: 1;
    }
    .header-card {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 14px 18px;
      border-radius: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .brand-sub {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .meta-box {
      font-size: 10px;
      color: #cbd5e1;
      text-align: right;
      line-height: 1.35;
    }
    .version-tag {
      display: inline-block;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .page-header-sub {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 10px;
      color: #64748b;
      font-size: 10.5px;
      font-weight: 600;
    }
    h2 {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 10px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    h3 {
      font-size: 11.5px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 6px;
      margin-bottom: 4px;
    }
    p {
      margin: 0 0 6px 0;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 6px;
    }
    .feature-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .feature-box.highlight {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .feature-box.amber {
      background: #fffbeb;
      border-color: #fde68a;
    }
    .feature-title {
      font-weight: 700;
      font-size: 11.5px;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 4px;
    }
    .feature-desc {
      font-size: 11px;
      color: #475569;
      line-height: 1.35;
    }
    kbd {
      background: #0f172a;
      color: #38bdf8;
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 10px;
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      margin-bottom: 6px;
      font-size: 10.5px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
    }
    ol, ul {
      margin: 4px 0 6px 16px;
      padding: 0;
      font-size: 11px;
      color: #334155;
    }
    li {
      margin-bottom: 2px;
    }
    .step-item {
      display: flex;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 11px;
      line-height: 1.35;
    }
    .step-num {
      background: #0284c7;
      color: #ffffff;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9.5px;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .scenario-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #0284c7;
      border-radius: 6px;
      padding: 7px 10px;
      margin-bottom: 6px;
    }
    .scenario-title {
      font-weight: 700;
      font-size: 11.5px;
      color: #0f172a;
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .scenario-tag {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      background: #e0f2fe;
      color: #0369a1;
    }
    .scenario-prompt {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 10.5px;
      font-style: italic;
      color: #0369a1;
      margin: 3px 0;
    }
    .footer-note {
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      margin-top: auto;
      font-size: 10px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>

  <!-- ========================================================
       HALAMAN 1: IDENTITAS, PACKAGING ZIP & INSTALASI CHROME
       ======================================================== -->
  <div class="page">
    <div class="page-content">
      <div class="header-card">
        <div>
          <div class="brand-title">
            <span>⚡</span> BUKU PETUNJUK OPERASIONAL RESMI
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 2px;">Pesat AI Browser Agent</div>
          <div class="brand-sub">Panduan Lengkap Instalasi, Konfigurasi AI, Integrasi Workspace & Skenario Kerja Berat</div>
        </div>
        <div class="meta-box">
          <span class="version-tag">Versi v1.1.0 (Terbaru)</span><br>
          Penyusun: <strong>Tim AI Engineering Pesat</strong><br>
          Format: <strong>Chrome Manifest V3</strong><br>
          Klasifikasi: <strong>Panduan Evaluator & Pengguna</strong>
        </div>
      </div>

      <h2>📦 1. Pengemasan Berkas & Struktur ZIP Ekstensi</h2>
      <p style="font-size: 11px;">Bagi Anda yang akan membagikan paket ekstensi kepada pengguna akhir atau tim evaluator:</p>
      
      <div class="feature-box highlight" style="margin-bottom: 8px;">
        <div class="feature-title">
          <span>⭐</span> Aturan Emas ZIP Ekstensi: Kompresi Hanya Folder <code>extension/</code>!
        </div>
        <div class="feature-desc">
          Anda <strong>HANYA PERLU</strong> mengompresi isi folder <code>extension/</code>. <strong>JANGAN</strong> mengompresi seluruh folder root proyek! Folder root memuat <code>node_modules/</code>, riwayat git, dan artefak pengujian Playwright (ratusan MB). Folder <code>extension/</code> adalah paket distribusi mandiri (*production build*) yang sangat ringan (&lt; 1 MB).
        </div>
      </div>

      <div class="grid-2">
        <div class="feature-box">
          <div class="feature-title" style="color: #16a34a;">✅ Wajib Masuk ZIP (Folder extension/)</div>
          <ul>
            <li><code>manifest.json</code></li>
            <li><code>background.js</code> & <code>content.js</code></li>
            <li>Folder <code>sidepanel/</code> (HTML, CSS, JS)</li>
            <li>Folder <code>skills/</code> & folder <code>icons/</code></li>
            <li>Modul inti: <code>agent-engine.js</code>, <code>ai-engine.js</code>, <code>context-engine.js</code>, <code>file-engine.js</code>, <code>config.js</code>, <code>logger.js</code></li>
          </ul>
        </div>
        <div class="feature-box">
          <div class="feature-title" style="color: #dc2626;">❌ Dilarang Masuk ZIP (Khusus Root Proyek)</div>
          <ul>
            <li>Folder <code>node_modules/</code> (ratusan MB)</li>
            <li>Folder <code>.git/</code> & folder <code>tests/</code></li>
            <li>Folder <code>playwright-report/</code> & <code>test-results/</code></li>
            <li>Berkas <code>package.json</code> & <code>package-lock.json</code></li>
            <li>Skrip backend Cloudflare <code>worker/</code> dan <code>functions/</code></li>
          </ul>
        </div>
      </div>

      <h2>🚀 2. Alur Instalasi Lengkap & Akses Cepat Hotkey</h2>
      <div class="step-item">
        <div class="step-num">1</div>
        <div><strong>Ekstrak Berkas ZIP</strong>: Ekstrak berkas <code>extension.zip</code> ke folder lokal komputer Anda (contoh: <code>C:\\Users\\Nama\\Documents\\PesatAgent</code>). Pastikan <code>manifest.json</code> langsung berada di tingkat teratas folder tersebut.</div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div><strong>Buka Manajemen Ekstensi Chrome</strong>: Buka browser Google Chrome, ketikkan <code>chrome://extensions</code> pada bilah URL (omnibox), lalu tekan <strong>Enter</strong>.</div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div><strong>Aktifkan Developer Mode</strong>: Pada pojok kanan atas halaman ekstensi, aktifkan sakelar (toggle switch) <strong>Developer mode</strong> hingga menyala biru.</div>
      </div>
      <div class="step-item">
        <div class="step-num">4</div>
        <div><strong>Pilih "Load unpacked"</strong>: Klik tombol <strong>Load unpacked</strong> di pojok kiri atas, arahkan ke folder hasil ekstrak tadi. Ekstensi Pesat AI Browser Agent akan langsung terpasang.</div>
      </div>
      <div class="step-item">
        <div class="step-num">5</div>
        <div><strong>Sematkan (Pin) ke Toolbar</strong>: Klik ikon potongan puzzle di toolbar Chrome, klik ikon pin 📌 di sebelah Pesat AI Browser Agent agar ikon selalu tampak di bilah atas.</div>
      </div>

      <div class="grid-2" style="margin-top: 8px;">
        <div class="feature-box highlight">
          <div class="feature-title">
            <span>⚡</span> Hotkey Buka Side Panel Bebas Konflik
          </div>
          <div class="feature-desc">
            Tekan <kbd>Ctrl+Shift+Y</kbd> (Mac: <kbd>⌘+Shift+Y</kbd>) di tab mana pun untuk membuka atau menutup side panel Pesat AI seketika tanpa perlu klik mouse dan bebas konflik sistem print!
          </div>
        </div>
        <div class="feature-box">
          <div class="feature-title">
            <span>⚙️</span> Kustomisasi Pintasan Mandiri
          </div>
          <div class="feature-desc">
            Buka menu <strong>Pengaturan (⚙️)</strong> lalu klik tombol <strong>"⚙️ Kustomisasi Hotkey di Chrome"</strong> untuk mengganti kombinasi tombol ke shortcut favorit Anda di <code>chrome://extensions/shortcuts</code>.
          </div>
        </div>
      </div>
    </div>

    <div class="footer-note">
      <span>Buku Panduan Pesat AI Agent • Versi 1.1.0</span>
      <span>Halaman 1 dari 4</span>
    </div>
  </div>

  <!-- ========================================================
       HALAMAN 2: KONFIGURASI AI, KONTEKS TAB & SALIN-TEMPEL
       ======================================================== -->
  <div class="page">
    <div class="page-content">
      <div class="page-header-sub">
        <span>⚡ Buku Panduan Operasional Pesat AI Browser Agent • Versi 1.1.0</span>
        <span>Halaman 2 dari 4</span>
      </div>

      <h2>🔑 3. Pemasangan AI API Key & Konfigurasi Model BYOK</h2>
      <p style="font-size: 11px;">Pesat AI Agent dapat dihubungkan ke penyedia gateway AI apa pun yang kompatibel dengan protokol OpenAI Chat Completions (PesatRouter Cloudflare Gateway, GPT-4o, Groq, atau OpenRouter).</p>
      
      <h3>A. Langkah Memasukkan API Key</h3>
      <div class="step-item">
        <div class="step-num">1</div>
        <div><strong>Buka Menu Pengaturan</strong>: Klik ikon roda gigi (⚙️) pada header kanan atas side panel Pesat AI.</div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div><strong>Isi API Base URL</strong>: Tentukan endpoint gateway AI Anda. Bawaan sistem: <code>https://api.pesatrouter.com/v1</code>.</div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div><strong>Masukkan API Key</strong>: Tempelkan kunci API Anda (format <code>sk-...</code> atau kunci Pesat). Gunakan tombol mata 👁️ untuk memverifikasi teks.</div>
      </div>
      <div class="step-item">
        <div class="step-num">4</div>
        <div><strong>Opsi "Simpan sesi ini saja" (Keamanan)</strong>: Centang opsi ini jika Anda menggunakan komputer kantor/bersama agar API Key otomatis terhapus saat peramban ditutup.</div>
      </div>
      <div class="step-item">
        <div class="step-num">5</div>
        <div><strong>Uji Koneksi & Simpan</strong>: Klik tombol ⚡ <strong>Test Connection</strong>. Setelah verifikasi hijau berhasil, klik <strong>Simpan Pengaturan</strong>.</div>
      </div>

      <h3>B. Penggantian Model Cepat (Quick Switcher Dropdown)</h3>
      <p style="font-size: 11px;">Ganti model AI secara instan via menu dropdown di bilah bawah komposer tanpa perlu masuk ke pengaturan:</p>
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Model ID</th>
            <th style="width: 35%;">Karakteristik</th>
            <th style="width: 40%;">Rekomendasi Pemakaian</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>pesat-flash</strong></td>
            <td>Super cepat, latensi rendah, efisiensi token tinggi</td>
            <td>Form filling otomatis, ekstraksi data web harian, draf medsos pendek, peringkasan berita instan.</td>
          </tr>
          <tr>
            <td><strong>pesat-pro</strong></td>
            <td>Penalaran mendalam, analisis sintesis komprehensif</td>
            <td>Bedah dokumen panjang (RAG), penyusunan laporan kebijakan, audit risiko multi-halaman.</td>
          </tr>
        </tbody>
      </table>

      <h2>🌐 4. Manajemen Konteks Tab Otomatis & Salin-Tempel Respons AI</h2>
      <div class="grid-2">
        <div class="feature-box highlight">
          <div class="feature-title">
            <span>🌐</span> Konteks Tab Aktif Otomatis & Persisten
          </div>
          <div class="feature-desc">
            Tombol <strong>[🌐 Tab Aktif: ON / OFF]</strong> di samping komposer secara otomatis membaca halaman web yang sedang dibuka. Anda dapat langsung mengetik pertanyaan tanpa mengetik <code>@</code> manual. Konteks tetap terikat pada pertanyaan lanjutan (*multi-turn*).
          </div>
        </div>
        <div class="feature-box">
          <div class="feature-title">
            <span>📑</span> Parser PDF Terkompresi Native
          </div>
          <div class="feature-desc">
            Mesin <code>file-engine.js</code> kini dilengkapi dekompresi FlateDecode dan pemetaan ToUnicode CMap. AI dapat mengekstrak teks lengkap dari dokumen PDF multi-halaman terkompresi tanpa bantuan server luar.
          </div>
        </div>
      </div>

      <h3>Bilah Aksi Salin & Tempel Balasan AI (Bebas Click-Drag Manual)</h3>
      <div class="grid-2">
        <div class="feature-box">
          <div class="feature-title"><span>💬</span> Balasan Chat Asisten AI</div>
          <div class="feature-desc">
            Di bawah setiap respon AI tersedia bilah aksi:
            <ul>
              <li><strong>📋 Salin</strong>: Salin seluruh teks respon ke clipboard dengan sekali klik (feedback <em>✓ Tersalin!</em>).</li>
              <li><strong>⤴️ Tempel ke Tab</strong>: Langsung menyuntikkan teks jawaban ke kolom input/editor di tab browser aktif.</li>
            </ul>
          </div>
        </div>
        <div class="feature-box">
          <div class="feature-title"><span>📊</span> Kartu Riset Tabel Data (Terpisah Tegas)</div>
          <div class="feature-desc">
            Untuk mencegah teks narasi tercampur delimiter TSV:
            <ul>
              <li><strong>📋 Salin Teks</strong>: Menyalin murni penjelasan narasi teks biasa.</li>
              <li><strong>📊 Salin Data Sheet</strong>: Khusus menyalin data tabel baris & kolom berformat TSV siap tempel ke Excel/Sheets.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-note">
      <span>Buku Panduan Pesat AI Agent • Versi 1.1.0</span>
      <span>Halaman 2 dari 4</span>
    </div>
  </div>

  <!-- ========================================================
       HALAMAN 3: INTEGRASI WORKSPACE, PEMBERSIHAN & SKENARIO 1-2
       ======================================================== -->
  <div class="page">
    <div class="page-content">
      <div class="page-header-sub">
        <span>⚡ Buku Panduan Operasional Pesat AI Browser Agent • Versi 1.1.0</span>
        <span>Halaman 3 dari 4</span>
      </div>

      <h2>📄 5. Integrasi Google Workspace & Perlindungan Kursor Dokumen</h2>
      <p style="font-size: 11px;">PENTING: Integrasi ini bersifat <strong>OPSIONAL</strong>. Seluruh fungsi inti (Form Filling, Ekspor Excel/CSV, Unduh Word .docx) berjalan 100% tanpa konfigurasi OAuth tambahan!</p>
      
      <table>
        <thead>
          <tr>
            <th style="width: 28%;">Fitur / Pengaturan</th>
            <th style="width: 27%;">Lokasi Tombol</th>
            <th style="width: 45%;">Mekanisme Kerja & Keuntungan</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Sakelar Auto-Paste Docs</strong></td>
            <td>Menu Pengaturan (⚙️) di bawah <em>Test Connection</em></td>
            <td>Default <strong>OFF</strong> (sakelar geser). Mencegah AI menimpa atau merusak kursor dokumen yang sedang Anda ketik di Google Docs/Sheets.</td>
          </tr>
          <tr>
            <td><strong>Tempel ke Docs (Tab Baru)</strong></td>
            <td>Tombol kartu artefak <code>⤴️ Tempel ke Docs</code></td>
            <td>Otomatis membuka <code>docs.new</code> di tab baru dan menuliskan artikel lengkap tanpa mengganggu tab kerja riset Anda.</td>
          </tr>
          <tr>
            <td><strong>Di Kursor Ini / Di Sheet Ini</strong></td>
            <td>Tombol kartu artefak <code>⤴️ Di Kursor Ini</code></td>
            <td>Pilihan fleksibel jika Anda memang menghendaki teks langsung ditempelkan pada posisi kursor dokumen yang aktif.</td>
          </tr>
          <tr>
            <td><strong>Unduh Word (.docx) & Excel (.xls)</strong></td>
            <td>Tombol unduh pada kartu artefak</td>
            <td>Mengekspor berkas Microsoft Word resmi berstandar eksekutif (bebas blokir Safe Browsing) dan tabel spreadsheet langsung ke komputer.</td>
          </tr>
        </tbody>
      </table>

      <h2>🧹 6. Pembersihan Konteks & Sesi Percakapan (Sesi Rapi)</h2>
      <div class="grid-2">
        <div class="feature-box">
          <div class="feature-title">
            <span>🧹</span> Tombol Sapu (Bersihkan Obrolan Sesi Ini)
          </div>
          <div class="feature-desc">
            Terletak di header samping tombol <code>+</code>. Membuka <strong>In-Panel Confirmation Modal</strong> modern bertema Slate di dalam side panel (bukan pop-up kaku peramban). Mengosongkan pesan sesi ini secara instan jika Anda menyetujui konfirmasi.
          </div>
        </div>
        <div class="feature-box">
          <div class="feature-title">
            <span>➕</span> Obrolan Baru (New Chat Steril)
          </div>
          <div class="feature-desc">
            Memulai sesi obrolan baru yang 100% bersih: mengosongkan lampiran berkas (<code>attachedContextSources</code>), mereset chip tray komposer, dan membersihkan memori tugas lama agar tidak terjadi bias percakapan (*context bleed*).
          </div>
        </div>
      </div>

      <h2>💼 7. Skenario Pekerjaan Berat & Contoh Pemakaian Nyata</h2>
      
      <div class="scenario-card">
        <div class="scenario-title">
          <span>Skenario 1: Bedah Dokumen RAG & Laporan Eksekutif Word (.docx)</span>
          <span class="scenario-tag">ANALISIS DOKUMEN</span>
        </div>
        <p style="font-size: 11px;">Menganalisis dokumen kebijakan/riset panjang, menemukan titik risiko kritis, dan mengekspor hasilnya menjadi berkas Word siap cetak.</p>
        <div class="scenario-prompt">
          "Lampirkan berkas Telaah_Kritis.docx: Bedah dokumen ini secara mendalam, temukan 3 titik risiko struktural krusial, dan susun rekomendasi aksi strategis dalam format laporan eksekutif."
        </div>
        <ul>
          <li><strong>Deteksi Lampiran</strong>: Berkas divisualisasikan dengan chip badge elegan di obrolan (nama & ukuran berkas).</li>
          <li><strong>Hasil Analisis</strong>: Agen menampilkan kartu artefak draf dokumen dengan tombol salin teks, unduh Word, dan tempel ke tab baru.</li>
        </ul>
      </div>

      <div class="scenario-card">
        <div class="scenario-title">
          <span>Skenario 2: Form Filling Kompleks & Dropdown Wilayah Berelasi</span>
          <span class="scenario-tag">AUTOMASI BROWSER</span>
        </div>
        <p style="font-size: 11px;">Mengisi formulir bertingkat yang memuat input teks berformat khusus, singkatan alamat bertitik, radio button, dan dropdown dinamis.</p>
        <div class="scenario-prompt">
          "Buka tab pendaftaran DemoQA: Isi nama Salman Alfarizi, email salman@test.com, jenis kelamin Male, telepon 081234567890, alamat Jl. Sudirman Kav. 45 Lt. 8, lalu pilih State NCR dan City Delhi."
        </div>
        <ul>
          <li><strong>Parser Alamat Kebal Titik</strong>: Parser alamat tidak terpotong pada singkatan <code>Jl.</code> atau <code>Lt.</code>.</li>
          <li><strong>Otomasi React-Select Dropdown</strong>: Agen mengklik wadah dropdown, memilih State, menunggu opsi kota aktif, lalu memilih City secara sinkron.</li>
        </ul>
      </div>
    </div>

    <div class="footer-note">
      <span>Buku Panduan Pesat AI Agent • Versi 1.1.0</span>
      <span>Halaman 3 dari 4</span>
    </div>
  </div>

  <!-- ========================================================
       HALAMAN 4: SKENARIO 3-4, TROUBLESHOOTING & RINGKASAN
       ======================================================== -->
  <div class="page">
    <div class="page-content">
      <div class="page-header-sub">
        <span>⚡ Buku Panduan Operasional Pesat AI Browser Agent • Versi 1.1.0</span>
        <span>Halaman 4 dari 4</span>
      </div>

      <div class="scenario-card">
        <div class="scenario-title">
          <span>Skenario 3: Riset Web Multi-Entitas, Ekspor Excel & Sinkronisasi Sheet</span>
          <span class="scenario-tag">WEB SCRAPE & SPREADSHEET</span>
        </div>
        <p style="font-size: 11px;">Membaca halaman data ensiklopedia/keuangan, menyaring entitas tertentu, dan mengekspornya menjadi format spreadsheet analitis.</p>
        <div class="scenario-prompt">
          "Berdasarkan tab Wikipedia yang sedang dibuka, ekstrak data 10 negara dengan PDB nominal terbesar, cantumkan nilai valuasi, kontribusi sektor industri, dan persentase pertumbuhan ke dalam format tabel excel."
        </div>
        <ul>
          <li><strong>Penyaringan Cerdas</strong>: Agen membuat Kartu Artefak Spreadsheet khusus (tema emerald/green) dengan preview tabel rapi.</li>
          <li><strong>Pemisahan Salin Data</strong>: Klik <strong>📊 Salin Data Sheet</strong> untuk menyalin data TSV atau klik <strong>⬇️ Unduh Excel (.xls)</strong> untuk berkas spreadsheet.</li>
        </ul>
      </div>

      <div class="scenario-card">
        <div class="scenario-title">
          <span>Skenario 4: Kurasi Berita, Komposisi Draf Medsos & Posting Threads</span>
          <span class="scenario-tag">SOCIAL DISTRIBUTION</span>
        </div>
        <p style="font-size: 11px;">Meringkas berita mendalam menjadi draf microblogging berbatas kata ketat, lalu memindahkannya langsung ke kotak postingan Threads / X.</p>
        <div class="scenario-prompt">
          "Rangkum peristiwa geopolitik dari artikel CNN di tab ini. Buatkan draft postingan berbobot tajam untuk Threads maksimal 65 kata, lalu bantu isi ke Threads."
        </div>
        <ul>
          <li><strong>Kepatuhan Batasan Kata</strong>: Menghasilkan draf padat di bawah batas 65 kata tanpa boilerplate ganda.</li>
          <li><strong>Human-in-the-Loop 🛡️</strong>: Menampilkan kartu konfirmasi keamanan sebelum melakukan tindakan pengetikan fisik di media sosial.</li>
        </ul>
      </div>

      <h2>🛠️ 8. Tips Ahli & Pemecahan Masalah (Troubleshooting)</h2>
      <div class="grid-2">
        <div class="feature-box">
          <div class="feature-title">💡 Tips Penulisan Prompt Efektif</div>
          <ul>
            <li><strong>Sebutkan Batasan Eksplisit</strong>: Misal: <em>"maksimal 3 poin"</em> atau <em>"maksimal 60 kata"</em>.</li>
            <li><strong>Sebutkan Format Keluaran</strong>: <em>"tabel excel"</em>, <em>"dokumen word"</em>, atau <em>"postingan threads"</em>.</li>
            <li><strong>Gunakan Sakelar Tab Aktif</strong>: Pastikan tombol <code>[Tab Aktif: ON]</code> menyala saat ingin menganalisis halaman web saat ini.</li>
          </ul>
        </div>
        <div class="feature-box">
          <div class="feature-title">🔧 Solusi Cepat Kendala Teknis</div>
          <ul>
            <li><strong>Hotkey Konflik</strong>: Gunakan default <kbd>Ctrl+Shift+Y</kbd> atau ubah di <code>chrome://extensions/shortcuts</code>.</li>
            <li><strong>Pembaruan Kode</strong>: Buka <code>chrome://extensions</code> dan klik ikon panah putar (Reload 🔄) pada kartu Pesat AI.</li>
            <li><strong>Unduhan Aman</strong>: Dokumen berekstensi <code>.docx</code> OpenXML lolos verifikasi Chrome Safe Browsing.</li>
          </ul>
        </div>
      </div>

      <h2>⭐ 9. Ringkasan Fitur Unggulan Sistem</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Fitur Unggulan</th>
            <th style="width: 35%;">Mekanisme Kerja</th>
            <th style="width: 40%;">Keunggulan Pengguna</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Hotkey Bebas Konflik</strong></td>
            <td>Perintah Chrome Commands <code>_execute_action</code></td>
            <td>Akses instan via <kbd>Ctrl+Shift+Y</kbd> tanpa mengganggu fungsi print atau menu sistem.</td>
          </tr>
          <tr>
            <td><strong>Konteks Tab Otomatis</strong></td>
            <td>Auto-binding background tab scraper persisten</td>
            <td>Tidak perlu ketik <code>@tab</code> manual; konteks halaman aktif bertahan di percakapan lanjutan.</td>
          </tr>
          <tr>
            <td><strong>Ekspor Word (.docx)</strong></td>
            <td>Generator ZIP OpenXML internal JavaScript</td>
            <td>Format resmi eksekutif siap cetak, lolos Safe Browsing, buka langsung di Microsoft Word & Docs.</td>
          </tr>
          <tr>
            <td><strong>Salin/Tempel Cerdas</strong></td>
            <td>Toolbar respon AI + pemisahan Teks vs TSV</td>
            <td>Bebas click-drag; salin data tabel tanpa merusak kolom dan suntikkan teks langsung ke tab aktif.</td>
          </tr>
          <tr>
            <td><strong>Human-in-the-Loop 🛡️</strong></td>
            <td>Kartu konfirmasi izin aksi interaktif</td>
            <td>Aman terkendali; aksi penulisan atau transaksi browser wajib disetujui eksplisit oleh pengguna.</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 6px; padding: 6px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 10.5px; color: #166534; text-align: center;">
        ✅ <strong>Pesat AI Browser Agent v1.1.0</strong> siap digunakan untuk pengujian menyeluruh dan operasional harian oleh Pak Nell & Mas Alfu.
      </div>
    </div>

    <div class="footer-note">
      <span>© 2026 Pesat AI Agent — Dikeluarkan untuk Tim & Pengguna PesatRouter</span>
      <span>Halaman 4 dari 4</span>
    </div>
  </div>

</body>
</html>
`;

async function generatePdf() {
  const outputPathDocs = path.join(__dirname, '..', 'docs', 'PANDUAN_PENGGUNAAN_PESAT_AI.pdf');
  const outputPathRoot = path.join(__dirname, '..', 'PANDUAN_PENGGUNAAN_PESAT_AI.pdf');
  const outputPathParent = path.join(__dirname, '..', '..', 'Panduan_Penggunaan_Pesat_AI.pdf');
  const outputPathExtension = path.join(__dirname, '..', 'extension', 'PANDUAN_PENGGUNAAN_PESAT_AI.pdf');
  const htmlPath = path.join(__dirname, '..', 'docs', 'PANDUAN_PENGGUNAAN_PESAT_AI.html');

  fs.writeFileSync(htmlPath, guideHtml, 'utf8');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.setContent(guideHtml, { waitUntil: 'networkidle' });

  await page.pdf({
    path: outputPathDocs,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm'
    }
  });

  // Salin ke lokasi terkait
  fs.copyFileSync(outputPathDocs, outputPathRoot);
  fs.copyFileSync(outputPathDocs, outputPathParent);
  fs.copyFileSync(outputPathDocs, outputPathExtension);
  await browser.close();

  console.log('Comprehensive official PDF generated successfully across destinations:');
  console.log('1. ' + outputPathDocs);
  console.log('2. ' + outputPathRoot);
  console.log('3. ' + outputPathParent);
  console.log('4. ' + outputPathExtension);
}

generatePdf().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
