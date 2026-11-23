const test = require('node:test');
const assert = require('node:assert/strict');

// ═══════════════════════════════════════════════════════════
// Salin fungsi murni dari sidepanel/sidepanel.js (konvensi repo:
// sidepanel.js IIFE/DOM-bound, tidak bisa di-require).
// Sumber: cleanAssistantReply / stripToolCallNoise / isToolCallNoise /
// sanitizeAssistantReply + buildLightMetadataContext (P1.7).
// ═══════════════════════════════════════════════════════════

function stripToolCallNoise(text) {
  if (!text || typeof text !== 'string') return text || '';
  let out = text;
  out = out.replace(/^\s*(?:[-*]\s*)?(?:<|mcp__|tool_call|function_call)[^\n]*$/gim, '');
  out = out.replace(/(?:^|\n)\s*(?:mcp__[a-z0-9_]+(?:\s|$)|<[a-z]+__[a-z0-9_]+__\w+[^>\n]*>)/g, '\n');
  out = out.replace(/```(?:tool_call|function_call|xml)[\s\S]*?```/gi, '');
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

// Sisa JSON tool-call setelah tag dibuang, mis. {"text":"Lewis Hamilton"}
function isToolCallPayloadJson(s) {
  const t = String(s || '').trim();
  if (!(t.startsWith('{') && t.endsWith('}'))) return false;
  try {
    const o = JSON.parse(t);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    const keys = Object.keys(o);
    const allowed = new Set(['text', 'value', 'input', 'elementId', 'key', 'targetText', 'url', 'action', 'args', 'parameters']);
    if (!keys.length) return true;
    return keys.every(k => allowed.has(k));
  } catch (e) {
    return false;
  }
}

function isToolCallNoise(text) {
  if (!text || typeof text !== 'string') return true;
  const stripped = stripToolCallNoise(text);
  if (stripped.length < 15) return true;
  const noiseMatches = (String(text).match(/mcp__|<[a-z]+__[a-z0-9_]+__|tool_call|function_call/gi) || []).length;
  if (noiseMatches > 0 && stripped.length < 40) return true;
  if (isToolCallPayloadJson(stripped)) return true;
  return false;
}

const FRIENDLY_RETRY_MSG = 'Maaf, saya belum bisa menyelesaikan perintah ini. Aktifkan Tab Aktif atau tulis perintahnya lebih spesifik.';

function sanitizeAssistantReply(text) {
  const cleaned = stripToolCallNoise(String(text || ''));
  return isToolCallNoise(cleaned) ? FRIENDLY_RETRY_MSG : cleaned;
}

// P1.7: konteks metadata ringan saat Tab Aktif OFF (tanpa content script)
function buildLightMetadataContext(activeTabInfo, pageTitle = '', pageUrl = '') {
  if (!activeTabInfo) return '';
  return `[INFO TAB AKTIF]\nJudul: ${activeTabInfo.title || pageTitle || ''}\nURL: ${activeTabInfo.url || pageUrl || ''}`.trim();
}

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
