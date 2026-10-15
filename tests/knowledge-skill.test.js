const test = require('node:test');
const assert = require('node:assert/strict');
const Knowledge = require('../extension/skills/knowledge.js');

function withFetch(handler, run) {
  const original = global.fetch;
  global.fetch = handler;
  return Promise.resolve(run()).finally(() => { global.fetch = original; });
}

test('search_knowledge sends bearer token and maps canonical citations', async () => {
  await withFetch(async (url, options) => {
    assert.equal(url, 'https://backend.test/api/knowledge/search');
    assert.equal(options.headers.Authorization, 'Bearer session-token');
    assert.deepEqual(JSON.parse(options.body), { query: 'revenue', topK: 3, sourceTypes: [] });
    return new Response(JSON.stringify({ sources: [{ citation: 'S1', sourceId: 'doc-1', chunkId: 'chunk-1', title: 'Report', content: 'Revenue grew' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }, async () => {
    const result = await Knowledge.execute('search_knowledge', { query: 'revenue', limit: 3 }, { backendBaseUrl: 'https://backend.test', authToken: 'session-token' });
    assert.equal(result.success, true);
    assert.equal(result.sources[0].sourceId, 'doc-1');
    assert.equal(result.citations[0].chunkId, 'chunk-1');
  });
});

test('get_source_excerpt maps returned chunk content', async () => {
  await withFetch(async () => new Response(JSON.stringify({ sourceId: 'doc-1', chunkId: 'chunk-1', title: 'Report', content: 'Exact excerpt' }), { status: 200 }), async () => {
    const result = await Knowledge.execute('get_source_excerpt', { sourceId: 'doc-1', chunkId: 'chunk-1' }, { backendBaseUrl: 'https://backend.test', authToken: 'session-token' });
    assert.equal(result.success, true);
    assert.equal(result.source.content, 'Exact excerpt');
  });
});

test('knowledge mutation uses canonical endpoint', async () => {
  await withFetch(async (url, options) => {
    assert.equal(url, 'https://backend.test/api/knowledge/documents');
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.sourceType, 'page');
    assert.equal(body.sourceUrl, 'https://example.com');
    return new Response(JSON.stringify({ document: { id: 'doc-1', title: body.title } }), { status: 200 });
  }, async () => {
    const result = await Knowledge.execute('save_page_to_knowledge', { title: 'Page', content: 'Useful text', sourceUrl: 'https://example.com' }, { backendBaseUrl: 'https://backend.test', authToken: 'session-token' });
    assert.equal(result.success, true);
    assert.equal(result.sourceId, 'doc-1');
    assert.equal(result.stateChanged, true);
  });
});
