const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveOfficialSources, cleanUrl, buildSourcesMarkdown } = require('../source-resolver.js');

test('cleanUrl strips tracking params and hash', () => {
  const out = cleanUrl('https://example.com/a?utm_source=x&id=7&fbclid=z#section');
  assert.equal(out, 'https://example.com/a?id=7');
});

test('cleanUrl returns empty for non-http', () => {
  assert.equal(cleanUrl('javascript:alert(1)'), '');
  assert.equal(cleanUrl(''), '');
});

test('resolveOfficialSources matches topic with official entries', () => {
  const list = resolveOfficialSources('berapa kurs dolar hari ini untuk investasi');
  assert.ok(list.length > 0);
  assert.ok(list.every(s => s.name && /^https?:\/\//.test(s.url)));
  assert.ok(list.some(s => s.kind === 'official'));
});

test('resolveOfficialSources falls back to generic news', () => {
  const list = resolveOfficialSources('halo apa kabar');
  assert.ok(list.length > 0);
  assert.ok(list.every(s => s.kind === 'news'));
});

test('buildSourcesMarkdown tags Resmi/Live and renders links', () => {
  const md = buildSourcesMarkdown([
    { name: 'IMF', url: 'https://www.imf.org?utm_source=z', kind: 'official' },
    { name: 'Reuters', url: 'https://www.reuters.com', kind: 'news' }
  ]);
  assert.match(md, /^## Sources/);
  assert.match(md, /\[IMF\]\(https:\/\/www\.imf\.org\/?\) \[Resmi\]/);
  assert.match(md, /\[Reuters\]\(https:\/\/www\.reuters\.com\/?\) \[Live\]/);
});

test('buildSourcesMarkdown empty for no valid items', () => {
  assert.equal(buildSourcesMarkdown([]), '');
  assert.equal(buildSourcesMarkdown([{ name: '', url: '' }]), '');
});