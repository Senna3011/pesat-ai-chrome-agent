# ⚡ Pesat AI Browser Agent

Chrome Extension (Manifest V3) berbasis AI Browser Automation yang terintegrasi dengan API AI Internal via Cloudflare Pages (Serverless Functions).

## 📁 Struktur Proyek
- `/extension`: Source code Chrome Extension (Side Panel UI, Background Service Worker, Content Scripts).
- `/functions`: Cloudflare Pages Functions (`/api/chat.js`) sebagai middleware/proxy aman untuk API AI Internal.

## 🚀 Cara Menjalankan Ekstensi Secara Lokal
1. Buka `chrome://extensions/` di Google Chrome.
2. Aktifkan **Developer mode** di pojok kanan atas.
3. Klik **Load unpacked** dan pilih folder `extension/`.
4. Buka website apa saja dan klik ikon ekstensi di toolbar untuk membuka Side Panel.

## ☁️ Deployment Cloudflare Pages
1. Hubungkan repository ini ke Cloudflare Pages.
2. Atur Environment Variables di dashboard Cloudflare Pages:
   - `AI_BASE_URL`: Endpoint API AI Internal
   - `AI_API_KEY`: API Key internal perusahaan
   - `AI_MODEL_NAME`: Nama model LLM yang digunakan
