const test = require('node:test');
const assert = require('node:assert/strict');

// ═══════════════════════════════════════════════════════════
// Uji fungsi produksi (bukan salinan lokal) dari tool-call-noise.js
// agar tidak ada pergeseran diam-diam antara runtime & unit test.
// ═══════════════════════════════════════════════════════════
const {
  stripToolCallNoise,
  isToolCallPayloadJson,
  isToolCallNoise,
  isRefusalReply,
  sanitizeAssistantReply,
  buildLightMetadataContext,
  FRIENDLY_RETRY_MSG
} = require('../tool-call-noise.js');

// ═══════════════════════════════════════════════════════════
// TEST: stripToolCallNoise
// ═══════════════════════════════════════════════════════════

test('stripToolCallNoise: buang baris mcp__plugin_playwright', () => {
  const raw = 'Jawaban:\n<mcp__plugin_playwright_playwright__browser_type>\n{"text":"Lewis Hamilton"}\n</mcp__plugin_playwright_playwright__browser_type>\nSelesai.';
  const out = stripToolCallNoise(raw);
  assert.ok(!out.includes('mcp__plugin'), `masih ada mcp__plugin: ${out}`);
  assert.ok(out.includes('Jawaban:'));
  assert.ok(out.includes('Selesai.'));
});

test('stripToolCallNoise: buang tag XML tool <name__tool__x>', () => {
  const raw = 'Sebelumnya:\n<chrome-extension-engineer__browser_type__click>\nfoo\n</chrome-extension-engineer__browser_type__click>\nSetelahnya.';
  const out = stripToolCallNoise(raw);
  assert.ok(!out.includes('__browser_type__'), out);
  assert.ok(out.includes('Setelahnya.'));
});

test('stripToolCallNoise: buang blok ```tool_call```', () => {
  const raw = 'Hasil:\n```tool_call\n{"action":"type_text"}\n```\nRampung.';
  const out = stripToolCallNoise(raw);
  assert.ok(!out.includes('tool_call'), out);
  assert.ok(out.includes('Rampung.'));
});

test('stripToolCallNoise: teks normal tidak tersentuh', () => {
  const normal = 'Berikut ringkasan artikel:\n1. Poin pertama\n2. Poin kedua\nKesimpulan: semua aman.';
  assert.equal(stripToolCallNoise(normal), normal);
});

// ═══════════════════════════════════════════════════════════
// TEST: isToolCallNoise
// ═══════════════════════════════════════════════════════════

test('isToolCallNoise: true untuk teks didominasi mcp__', () => {
  assert.equal(isToolCallNoise('<mcp__plugin_playwright_playwright__browser_type>\n{"text":"Lewis Hamilton"}'), true);
});

test('isToolCallNoise: true untuk string kosong/pendek', () => {
  assert.equal(isToolCallNoise(''), true);
  assert.equal(isToolCallNoise('ok'), true);
});

test('isToolCallNoise: false untuk jawaban panjang normal', () => {
  assert.equal(isToolCallNoise('Hamilton adalah pembalap F1 legendaris dengan tujuh gelar dunia yang memenangkan banyak balapan sepanjang karirnya.'), false);
});

// ═══════════════════════════════════════════════════════════
// TEST: sanitizeAssistantReply
// ═══════════════════════════════════════════════════════════

test('sanitizeAssistantReply: pesan sampah mcp__ → friendly fallback', () => {
  const out = sanitizeAssistantReply('<mcp__plugin_playwright_playwright__browser_type>\n{"text":"Lewis Hamilton"}\n</mcp__plugin_playwright_playwright__browser_type>');
  assert.equal(out, FRIENDLY_RETRY_MSG);
});

test('sanitizeAssistantReply: teks campur → hanya sisa bersih', () => {
  const out = sanitizeAssistantReply('Penjelasan:\n<mcp__foo__bar__baz>x</mcp__foo__bar__baz>\nHamilton juara dunia tujuh kali.');
  assert.ok(!out.includes('mcp__foo'), out);
  assert.ok(out.includes('Hamilton juara dunia tujuh kali.'));
});

test('sanitizeAssistantReply: teks normal dipertahankan', () => {
  const normal = 'Lewis Hamilton adalah pembalap F1 berkebangsaan Inggris yang memenangkan tujuh gelar dunia.';
  assert.equal(sanitizeAssistantReply(normal), normal);
});

test('sanitizeAssistantReply: sisa JSON tool-call {"text":...} → friendly fallback', () => {
  const out = sanitizeAssistantReply('{"text":"Lewis Hamilton"}');
  assert.equal(out, FRIENDLY_RETRY_MSG);
});

test('sanitizeAssistantReply: JSON jawaban sah {"message":...} TIDAK dianggap noise', () => {
  // cleanAssistantReply mengekstrak field dulu; di sini hanya memastikan payload JSON
  // dengan key di luar daftar tool-call tidak ditandai sebagai noise.
  assert.equal(isToolCallPayloadJson('{"message":"Selesai, dokumen sudah ditulis."}'), false);
  assert.equal(isToolCallPayloadJson('{"answer":"Hamilton juara."}'), false);
});

// ═══════════════════════════════════════════════════════════
// TEST: buildLightMetadataContext (P1.7 — Tab Aktif OFF)
// ═══════════════════════════════════════════════════════════

test('buildLightMetadataContext: OFF toggle → judul + URL tanpa content script', () => {
  const out = buildLightMetadataContext({ title: 'Contoh Halaman', url: 'https://example.com/x' });
  assert.ok(out.includes('Contoh Halaman'));
  assert.match(out, /https:\/\/example\.com\/x/);
  assert.ok(out.includes('[INFO TAB AKTIF]'));
});

test('buildLightMetadataContext: tanpa activeTabInfo → string kosong', () => {
  assert.equal(buildLightMetadataContext(null), '');
});

test('buildLightMetadataContext: fallback ke pageTitle/pageUrl bila field tab kosong', () => {
  const out = buildLightMetadataContext({ title: '', url: '' }, 'Judul Cadangan', 'https://cadangan.id');
  assert.ok(out.includes('Judul Cadangan'));
  assert.ok(out.includes('https://cadangan.id'));
});

// ═══════════════════════════════════════════════════════════
// TEST: isRefusalReply (respons "tidak ada tool" → retry)
// ═══════════════════════════════════════════════════════════

test('isRefusalReply: true untuk pesan refusal tool/tanpa akses (kasus nyata Tokopedia)', () => {
  const refusal = 'Tidak bisa buka Tokopedia — sesi ini tanpa akses browser/network. Tidak ada tool tersedia.\n\nDua opsi:\nKamu scrape/buka link https://www.tokopedia.com/search?q=laptop, tempel daftarnya ke sini (nama produk + harga), saya rapikan jadi tabel Markdown.\nSaya buatkan template spreadsheet kosong dulu (header: No, Merek & Model) + formula Rata-rata/Min/Max, tinggal isi data.\n\nPilih mana? Kalau mau langsung lengkap, kirim screenshot/teks hasil pencarian.';
  assert.equal(isRefusalReply(refusal), true);
});

test('isRefusalReply: true untuk refusal Inggris "no tools available"', () => {
  const refusal = 'I cannot open the website because this session has no access to browser or network. There are no tools available. Please paste the data here and I will format it.';
  assert.equal(isRefusalReply(refusal), true);
});

test('isRefusalReply: false untuk jawaban normal yang menyebut kata "tool" sekali', () => {
  const normal = 'Berikut ringkasan artikel tentang kecerdasan buatan:\n\n1. Definisi AI\n2. Aplikasi industri\n3. Tantangan etika\n\nKesimpulan: AI berkembang pesat namun membutuhkan regulasi.';
  assert.equal(isRefusalReply(normal), false);
});

test('isRefusalReply: false untuk tabel jawaban yang valid', () => {
  const table = '| No | Merek | Harga |\n|---|---|---|\n| 1 | Asus ROG | Rp 45.000.000 |\n| 2 | Lenovo Legion | Rp 42.000.000 |\n\nAnalisis: Asus menawarkan performa terbaik.';
  assert.equal(isRefusalReply(table), false);
});

test('isRefusalReply: false untuk string pendek/kosong', () => {
  assert.equal(isRefusalReply(''), false);
  assert.equal(isRefusalReply('ok'), false);
});

test('sanitizeAssistantReply: refusal tool → FRIENDLY_RETRY_MSG', () => {
  const refusal = 'Tidak bisa buka Tokopedia — sesi ini tanpa akses browser/network. Tidak ada tool tersedia. Pilih mana? Kirim screenshot/teks hasil pencarian.';
  assert.equal(sanitizeAssistantReply(refusal), FRIENDLY_RETRY_MSG);
});
