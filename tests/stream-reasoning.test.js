const test = require('node:test');
const assert = require('node:assert/strict');

// ═══════════════════════════════════════════════════════════
// Regresi R2: fetchStreamSSE harus memperlakukan reasoning_content
// sebagai jawaban. Model pesat-flash mengirim content:"" dan
// menaruh jawaban di delta.reasoning_content. Sebelum perbaikan,
// onChunk tidak pernah dipanggil dan reply bisa kosong.
// ═══════════════════════════════════════════════════════════

const { fetchStreamSSE } = require('../api-client.js');

// Membuat Response palsu dengan body ReadableStream dari daftar baris SSE.
function makeSseResponse(lines) {
  const payload = lines.map((l) => `${l}\n`).join('');
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    }
  });
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body,
    text: async () => payload
  };
}

// Menjalankan fetchStreamSSE dengan global.fetch yang di-stub.
async function runStream(lines, onChunk) {
  const originalFetch = global.fetch;
  global.fetch = async () => makeSseResponse(lines);
  try {
    return await fetchStreamSSE('https://example.test/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }, onChunk);
  } finally {
    global.fetch = originalFetch;
  }
}

test('fetchStreamSSE: content kosong + reasoning_content → reply terisi', async () => {
  const lines = [
    'data: {"choices":[{"delta":{"content":"","reasoning_content":"Ringkasan "}}]}',
    'data: {"choices":[{"delta":{"content":"","reasoning_content":"artikel ini."}}]}',
    'data: [DONE]'
  ];

  const res = await runStream(lines, null);

  assert.equal(res.success, true);
  assert.equal(res.reply, 'Ringkasan artikel ini.');
  assert.equal(res.reasoning, 'Ringkasan artikel ini.');
});

test('fetchStreamSSE: onChunk dipanggil saat hanya reasoning_content tersedia', async () => {
  const lines = [
    'data: {"choices":[{"delta":{"content":"","reasoning_content":"Halo "}}]}',
    'data: {"choices":[{"delta":{"content":"","reasoning_content":"dunia"}}]}',
    'data: [DONE]'
  ];

  const chunks = [];
  const res = await runStream(lines, (delta, accumulated) => {
    chunks.push({ delta, accumulated });
  });

  assert.equal(res.reply, 'Halo dunia');
  assert.ok(chunks.length > 0, 'onChunk harus dipanggil minimal sekali');
  assert.equal(chunks[chunks.length - 1].accumulated, 'Halo dunia',
    'akumulator terakhir harus sama dengan reply akhir');
});

test('fetchStreamSSE: delta.reasoning (tanpa _content) juga diproses', async () => {
  const lines = [
    'data: {"choices":[{"delta":{"reasoning":"jawaban fallback"}}]}',
    'data: [DONE]'
  ];

  const res = await runStream(lines, null);

  assert.equal(res.reply, 'jawaban fallback');
});

test('fetchStreamSSE: content normal tetap diproses seperti biasa', async () => {
  const lines = [
    'data: {"choices":[{"delta":{"content":"Halo"}}]}',
    'data: {"choices":[{"delta":{"content":" dunia"}}]}',
    'data: [DONE]'
  ];

  const chunks = [];
  const res = await runStream(lines, (delta, accumulated) => {
    chunks.push({ delta, accumulated });
  });

  assert.equal(res.reply, 'Halo dunia');
  assert.equal(chunks.length, 2, 'setiap chunk content harus memicu onChunk');
});

test('fetchStreamSSE: tidak ada delta sama sekali → reply kosong tanpa error', async () => {
  const lines = ['data: [DONE]'];

  const res = await runStream(lines, null);

  assert.equal(res.success, true);
  assert.equal(res.reply, '');
});