const test = require('node:test');
const assert = require('node:assert/strict');
const Agent = require('../agent-engine.js');
const WebScraperSkill = require('../skills/web-scraper.js');

// Cermin fungsi parseSerpRankingParams dari sidepanel.js
function parseSerpRankingParams(prompt = '') {
  const text = String(prompt).trim();
  const isSerpIntent = /(?:(?:cek|cari|temukan|lihat|lacak)\s+(?:posisi|ranking|peringkat|urutan|halaman|website|situs)|(?:posisi|ranking|peringkat|urutan|halaman)\s+berapa|(?:serp|ranking\s+google|posisi\s+google))/i.test(text) &&
    /(?:keyword|kata\s+kunci|kw\b|di\s+google|serp)/i.test(text);

  if (!isSerpIntent) return null;

  // 1. Ekstrak Target Domain
  let targetDomain = '';
  const domainMatch = text.match(/(?:website|situs|web|url|domain)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s?]*)?)/i) ||
                      text.match(/\b([a-zA-Z0-9][a-zA-Z0-9.-]*\.(?:com|id|co\.id|net|org|xyz|io|biz|info|site|online|tech|edu|gov))\b/i) ||
                      text.match(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (domainMatch) {
    targetDomain = domainMatch[1].replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').trim().toLowerCase();
  }

  // 2. Ekstrak Keyword
  let keyword = '';
  const kwMatch = text.match(/(?:keyword|kata\s+kunci|kw)\s*[:=]?\s*["'“]([^"'“”\n]+)["'”]/i) ||
                  text.match(/(?:keyword|kata\s+kunci|kw)\s*[:=]?\s*([a-zA-Z0-9\s-]+?)(?:\s+(?:ada\s+di|di|pada|ranking|posisi|peringkat|halaman|\?|\.|$))/i);
  if (kwMatch) {
    keyword = kwMatch[1].trim();
  }

  // 3. Ekstrak Max Pages jika ada spesifik
  let maxPages = 5;
  const pageMatch = text.match(/(?:sampai|hingga|max|maksimal)\s+(?:halaman\s+)?(\d+)\s*(?:halaman|page)?/i);
  if (pageMatch) {
    maxPages = Math.min(10, Math.max(1, parseInt(pageMatch[1], 10)));
  }

  return { isSerpIntent: true, targetDomain, keyword, maxPages };
}

function matchDomain(itemDomain = '', targetDomain = '', itemUrl = '') {
  const normItem = itemDomain.toLowerCase();
  const normTarget = targetDomain.toLowerCase();
  return normItem === normTarget ||
         normItem.endsWith('.' + normTarget) ||
         normTarget.endsWith('.' + normItem) ||
         normItem.includes(normTarget) ||
         normTarget.includes(normItem) ||
         (itemUrl || '').toLowerCase().includes(normTarget);
}

function calculateAbsoluteRank(page, rankOnPage) {
  return (page - 1) * 10 + rankOnPage;
}

test('SERP parser: correctly extracts targetDomain and keyword from Mas Alfu feedback prompt', () => {
  const prompt = 'Tolong cek website filterairgadingserpong.com dengan Keyword filter air tangerang ada di posisi berapa?';
  const params = parseSerpRankingParams(prompt);

  assert.ok(params);
  assert.equal(params.isSerpIntent, true);
  assert.equal(params.targetDomain, 'filterairgadingserpong.com');
  assert.equal(params.keyword, 'filter air tangerang');
  assert.equal(params.maxPages, 5);
});

test('SERP parser: extracts custom maxPages when specified in prompt', () => {
  const prompt = 'Cek posisi filterairgadingserpong.com untuk keyword "filter air tangerang" sampai halaman 10';
  const params = parseSerpRankingParams(prompt);

  assert.ok(params);
  assert.equal(params.targetDomain, 'filterairgadingserpong.com');
  assert.equal(params.keyword, 'filter air tangerang');
  assert.equal(params.maxPages, 10);
});

test('SERP parser: ignores non-SERP prompts', () => {
  assert.equal(parseSerpRankingParams('Tolong buatkan draf artikel tentang filter air'), null);
  assert.equal(parseSerpRankingParams('Rangkum halaman web yang sedang aktif ini'), null);
});

test('SERP ranking math: calculates accurate multi-page absolute position', () => {
  // Page 1, pos 4 -> #4
  assert.equal(calculateAbsoluteRank(1, 4), 4);
  // Page 2, pos 4 -> #14
  assert.equal(calculateAbsoluteRank(2, 4), 14);
  // Page 3, pos 1 -> #21
  assert.equal(calculateAbsoluteRank(3, 1), 21);
  // Page 6, pos 8 -> #58
  assert.equal(calculateAbsoluteRank(6, 8), 58);
});

test('SERP domain matching: handles www, subdomains, and URL paths cleanly', () => {
  const target = 'filterairgadingserpong.com';

  assert.equal(matchDomain('filterairgadingserpong.com', target), true);
  assert.equal(matchDomain('www.filterairgadingserpong.com', target), true);
  assert.equal(matchDomain('promo.filterairgadingserpong.com', target), true);
  assert.equal(matchDomain('anotherdomain.com', target, 'https://filterairgadingserpong.com/page-1'), true);
  assert.equal(matchDomain('kompetitorlain.id', target), false);
});

test('AgentEngine: classifies SERP check as execute or hybrid mode with browser capability', () => {
  const task = Agent.classifyTask('Tolong cek website filterairgadingserpong.com dengan Keyword filter air tangerang ada di posisi berapa?');
  assert.ok(task.mode === 'execute' || task.mode === 'hybrid', `Mode should be execute or hybrid, got: ${task.mode}`);
  assert.ok(task.capabilities.includes('browser'));
  assert.equal(Agent.isSimpleDirectTask('Tolong cek website filterairgadingserpong.com dengan Keyword filter air tangerang ada di posisi berapa?'), false);
});

test('WebScraperSkill: registers check_serp_ranking tool with required parameters', () => {
  const serpTool = WebScraperSkill.tools.find(t => t.function.name === 'check_serp_ranking');
  assert.ok(serpTool, 'check_serp_ranking tool must exist');
  assert.deepEqual(serpTool.function.parameters.required, ['keyword', 'targetDomain']);
});
