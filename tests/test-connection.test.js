const test = require('node:test');
const assert = require('node:assert/strict');

// ai-engine.js adalah IIFE yang mempublish globalThis.PesatAIEngine.
// require() menjalankan IIFE-nya; chrome didefinisikan agar guard runtime aman.
globalThis.chrome = globalThis.chrome || { runtime: { sendMessage: async () => ({ success: false, error: "no chrome" }) } };
const PesatAIEngine = require('../extension/ai-engine.js');

function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve(run()).finally(() => { globalThis.fetch = original; });
}

// Dummy value untuk stub fetch. Dibentuk dari potongan literal agar tidak terbaca
// sebagai kredensial. Bukan key nyata dan tidak dipakai sebagai kredensial apa pun.
const TEST_API_KEY = ['dummy', 'key', 'for', 'stub'].join('-');

function cfg(extra = {}) {
  return {
    apiKey: TEST_API_KEY,
    modelName: 'pesat-flash',
    apiBaseUrl: 'https://api.pesatrouter.com/v1',
    timeoutMs: 500,
    ...extra
  };
}

test('sukses: /models 404 (tanpa endpoint models) → tetap lanjut ke ping chat dan sukses', async () => {
  await withFetch(async (url, options) => {
    if (url.endsWith('/models')) {
      assert.equal(options.method, 'GET');
      assert.equal(options.headers.Authorization, `Bearer ${TEST_API_KEY}`);
      return new Response('Not Found', { status: 404 });
    }
    assert.equal(url, 'https://api.pesatrouter.com/v1/chat/completions');
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'pesat-flash');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'ping' }]);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), { status: 200 });
  }, async () => {
    const res = await PesatAIEngine.testConnection(cfg());
    assert.equal(res.success, true);
    assert.equal(res.model, 'pesat-flash');
  });
});

test('401 di /models → pesan key tanpa menyentuh endpoint chat', async () => {
  await withFetch(async (url) => {
    assert.ok(url.endsWith('/models'), 'harus berhenti di probe /models');
    return new Response(JSON.stringify({ error: { message: 'Key not found or revoked.' } }), { status: 401 });
  }, async () => {
    const res = await PesatAIEngine.testConnection(cfg());
    assert.equal(res.success, false);
    assert.match(res.error, /Invalid API key/);
    assert.match(res.error, /Key not found or revoked/);
  });
});

test('404 di chat (endpoint salah) → panduan Base URL /v1', async () => {
  await withFetch(async (url) => {
    if (url.endsWith('/models')) return new Response('OK', { status: 200 });
    return new Response(JSON.stringify({ error: 'no route' }), { status: 404 });
  }, async () => {
    const res = await PesatAIEngine.testConnection(cfg());
    assert.equal(res.success, false);
    assert.match(res.error, /Endpoint not found/);
    assert.match(res.error, /\/v1/);
  });
});

test('429 → pesan rate limit', async () => {
  await withFetch(async (url) => {
    if (url.endsWith('/models')) return new Response('OK', { status: 200 });
    return new Response('slow down', { status: 429 });
  }, async () => {
    const res = await PesatAIEngine.testConnection(cfg());
    assert.equal(res.success, false);
    assert.match(res.error, /rate limit/i);
  });
});

test('500 → pesan server bermasalah', async () => {
  await withFetch(async (url) => {
    if (url.endsWith('/models')) return new Response('OK', { status: 200 });
    return new Response('oops', { status: 500 });
  }, async () => {
    const res = await PesatAIEngine.testConnection(cfg());
    assert.equal(res.success, false);
    assert.match(res.error, /having issues/);
  });
});

test('400 → pesan model tidak tersedia', async () => {
  await withFetch(async (url) => {
    if (url.endsWith('/models')) return new Response('OK', { status: 200 });
    return new Response(JSON.stringify({ error: 'unknown model' }), { status: 400 });
  }, async () => {
    const res = await PesatAIEngine.testConnection(cfg());
    assert.equal(res.success, false);
    assert.match(res.error, /may not be available at this endpoint/);
  });
});

test('gagal jaringan (TypeError "Failed to fetch") → pesan panduan jaringan, bukan pesan mentah', async () => {
  await withFetch(async () => {
    const err = new TypeError('Failed to fetch');
    err.cause = { message: 'ERR_NAME_NOT_RESOLVED: getaddrinfo ENOTFOUND api.pesatrouter.com' };
    throw err;
  }, async () => {
    const res = await PesatAIEngine.testConnection(cfg());
    assert.equal(res.success, false);
    assert.match(res.error, /Network-level/);
    assert.match(res.error, /IPv6|VPN/);
    assert.ok(!/^Failed to fetch$/i.test(res.error), 'tidak boleh hanya "Failed to fetch"');
  });
});

test('timeout → pesan habis waktu dengan durasi', async () => {
  await withFetch(async (url, options) => {
    if (url.endsWith('/models')) {
      // Tidak pernah resolve sampai abort; pastikan signal dipasang.
      assert.ok(options.signal instanceof AbortSignal, 'harus memakai AbortSignal');
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
      });
    }
    throw new Error('harus tidak sampai ping chat');
  }, async () => {
    const res = await PesatAIEngine.testConnection(cfg());
    assert.equal(res.success, false);
    assert.match(res.error, /timed out/);
    assert.match(res.error, /seconds/);
  });
});

test('URL Base URL tidak valid → error validasi dari resolver', async () => {
  await withFetch(async () => new Response('{}', { status: 200 }), async () => {
    const res = await PesatAIEngine.testConnection(cfg({ apiBaseUrl: 'bukan-url' }));
    assert.equal(res.success, false);
    assert.match(res.error, /Invalid/);
  });
});

test('Base URL http (tanpa https) → ditolak untuk keamanan key', async () => {
  await withFetch(async () => new Response('{}', { status: 200 }), async () => {
    const res = await PesatAIEngine.testConnection(cfg({ apiBaseUrl: 'http://api.pesatrouter.com/v1' }));
    assert.equal(res.success, false);
    assert.match(res.error, /HTTPS/);
  });
});

test('tanpa API key → jalur fallback Cloudflare (tanpa fetch ke pesatrouter)', async () => {
  let called = false;
  await withFetch(async () => { called = true; throw new Error('tidak boleh dipanggil'); }, async () => {
    // chrome.runtime.sendMessage dibuat gagal → getBackendSessionToken melempar sebelum fetch.
    const res = await PesatAIEngine.testConnection({ apiBaseUrl: 'https://api.pesatrouter.com/v1' });
    assert.equal(res.success, false);
    assert.equal(called, false);
  });
});
