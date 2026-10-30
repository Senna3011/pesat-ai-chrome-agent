const test = require('node:test');
const assert = require('node:assert/strict');
const Agent = require('../agent-engine.js');
const SkillRegistry = require('../skills/skill-registry.js');

function parseWordReplacementParams(prompt = '') {
  const text = String(prompt).trim();
  const directSelMatch = text.match(/(?:ganti|ubah|replace)\s+(?:kata\s+ini|teks\s+ini|ini|(?:kata\s+|teks\s+)?yang\s+(?:saya\s+)?(?:ditandai|tandai|diblok|blok|dipilih|pilih|diseleksi|seleksi))\s*(?:menjadi|jadi|dengan|ke|with|to)\s*["'“]?([^"'“”\n]+)["'”]?/i);
  if (directSelMatch) {
    return {
      findText: "(terseleksi)",
      replaceText: directSelMatch[1].trim(),
      isDirectSelection: true,
      replaceAll: false
    };
  }

  const m = text.match(/(?:ganti|ubah|replace)\s+(?:kata|word|text|teks|kalimat|frasa|tulisan)?\s*["'“]([^"'“”]+)["'”]\s*(?:menjadi|jadi|dengan|ke|with|to)\s*["'“]([^"'“”]+)["'”]/i) ||
            text.match(/(?:ganti|ubah|replace)\s+(?:1\s+kata|kata|word|text|teks|kalimat|frasa|tulisan)\s+([^\s"']+)\s+(?:menjadi|jadi|dengan|ke|with|to)\s+([^\s"']+)/i) ||
            text.match(/(?:ganti|ubah|replace)\s+([^\s"']+)\s+(?:menjadi|jadi|dengan|with)\s+([^\s"']+)\s+(?:di|pada|in)\s+(?:gdocs|docs|google\s+docs|dokumen)/i);
  if (m) {
    return {
      findText: m[1].trim(),
      replaceText: m[2].trim(),
      replaceAll: /(?:semua|seluruh|all)/i.test(text)
    };
  }
  return null;
}

function sanitizeDocInsertText(rawText) {
  if (!rawText) return '';
  let clean = String(rawText).trim();
  clean = clean.replace(/^(?:(?:mohon\s+)?maaf(?:\s+(?:atas|ya|sebelumnya|kekeliruannya))?[^.\n]*[.:\n]+|\b(?:tentu|baik(?:lah)?|halo|hai)\b[^.\n]*[.:\n]+)/i, '');
  clean = clean.replace(/^(?:(?:i\s+)?apologize|sorry\s+(?:for|about)?|sure|certainly)[^.\n]*[.:\n]+/i, '');
  clean = clean.replace(/^(?:berikut(?:\s+adalah)?\s+(?:hasil|draf|teks|konten|perbaikan|pengganti(?:nya)?)[^.:\n]*[.:\n]+)/i, '');
  clean = clean.replace(/^(?:here\s+is\s+(?:the\s+)?(?:text|replacement|result)[^.:\n]*[.:\n]+)/i, '');
  clean = clean.replace(/\n+(?:semoga\s+membantu|ada\s+yang\s+bisa\s+saya\s+bantu|apakah\s+ada\s+hal\s+lain|let\s+me\s+know|hope\s+this\s+helps)[^\n]*$/i, '');
  return clean.trim();
}

function isPromptToDocsIntent(prompt = '') {
  const text = String(prompt).trim();
  return /(?:buka\s+(?:claude|chatgpt|gpt|ai|web).*(?:proses|buat|tulis|jawab|generate).*(?:lalu|kemudian|dan)?\s*(?:paste|tempel|masukkan|isi)\s+ke\s+(?:gdocs|docs|dokumen)|(?:proses|jalankan|buatkan).*prompt.*(?:lalu|kemudian|dan)?\s*(?:paste|tempel|masukkan)\s+ke\s+(?:gdocs|docs|dokumen))/i.test(text);
}

test('Word replacement parser: extracts findText and replaceText from client feedback pattern', () => {
  const p1 = 'Nyoba minta dia ganti 1 kata Apel jadi Jeruk di Gdocs';
  const res1 = parseWordReplacementParams(p1);
  assert.ok(res1);
  assert.equal(res1.findText, 'Apel');
  assert.equal(res1.replaceText, 'Jeruk');

  const p2 = 'Tolong ganti kata "Target Pendapatan" menjadi "Omset" di dokumen';
  const res2 = parseWordReplacementParams(p2);
  assert.ok(res2);
  assert.equal(res2.findText, 'Target Pendapatan');
  assert.equal(res2.replaceText, 'Omset');

  const p3 = 'replace word "OldValue" with "NewValue"';
  const res3 = parseWordReplacementParams(p3);
  assert.ok(res3);
  assert.equal(res3.findText, 'OldValue');
  assert.equal(res3.replaceText, 'NewValue');
});

test('Word replacement parser: detects direct in-place selection patterns without old word name', () => {
  const p1 = "ganti yang ditandai menjadi 'rangkuman'";
  const res1 = parseWordReplacementParams(p1);
  assert.ok(res1);
  assert.equal(res1.isDirectSelection, true);
  assert.equal(res1.replaceText, 'rangkuman');

  const p2 = "ubah kata yang diblok jadi 'kesimpulan'";
  const res2 = parseWordReplacementParams(p2);
  assert.ok(res2);
  assert.equal(res2.isDirectSelection, true);
  assert.equal(res2.replaceText, 'kesimpulan');

  const p3 = "ganti ini menjadi rangkuman";
  const res3 = parseWordReplacementParams(p3);
  assert.ok(res3);
  assert.equal(res3.isDirectSelection, true);
  assert.equal(res3.replaceText, 'rangkuman');
});

test('Word replacement parser: rejects general drafting and table creation prompts', () => {
  assert.equal(parseWordReplacementParams('Buatkan tabel ringkasan keuangan'), null);
  assert.equal(parseWordReplacementParams('Tolong draf artikel tentang AI'), null);
});

test('Doc insert sanitizer: removes AI apologies, chatter, and closing fluff', () => {
  const aiChatter = 'Mohon maaf atas kekeliruannya, kamu meminta ganti kata Apel jadi Jeruk.\n\nBerikut teks penggantinya:\nJeruk Segar Manis\n\nSemoga membantu!';
  const clean = sanitizeDocInsertText(aiChatter);
  assert.equal(clean, 'Jeruk Segar Manis');
  assert.ok(!clean.includes('Mohon maaf'));
  assert.ok(!clean.includes('Semoga membantu'));
});

test('Cross-service intent detector: identifies prompt-to-docs workflow', () => {
  const p1 = 'buka Claude, proses prompt dibawah, lalu paste ke Gdocs';
  assert.equal(isPromptToDocsIntent(p1), true);

  const p2 = 'proses prompt berikut lalu tempel ke docs';
  assert.equal(isPromptToDocsIntent(p2), true);

  const p3 = 'buka komposer twitter dan ketik postingan';
  assert.equal(isPromptToDocsIntent(p3), false);
});

test('SkillRegistry: registers open_new_tab and switch_to_tab as native tools', () => {
  const all = SkillRegistry.getAllTools();
  const openTool = all.find(t => (t.function?.name || t.name) === 'open_new_tab');
  const switchTool = all.find(t => (t.function?.name || t.name) === 'switch_to_tab');

  assert.ok(openTool, 'open_new_tab must be registered');
  assert.ok(switchTool, 'switch_to_tab must be registered');
  assert.deepEqual(openTool.function.parameters.required, ['url']);
});

test('AgentEngine: classifies multi-step cross-tab request as execute/hybrid mode', () => {
  const task = Agent.classifyTask('buka Claude, proses prompt dibawah, lalu paste ke Gdocs');
  assert.ok(task.mode === 'execute' || task.mode === 'hybrid');
  assert.ok(task.capabilities.includes('browser'));
  assert.equal(Agent.isSimpleDirectTask('buka Claude, proses prompt dibawah, lalu paste ke Gdocs'), false);
});

test('Explicit Docs destination detector: accurately triggers auto-paste to docs for natural language phrases', () => {
  const isExplicitNavigateDocs = (prompt) => /(?:(?:buka|open|masukkan|buat(?:kan)?|tulis(?:kan)?|isi(?:kan)?|tempel(?:kan)?|salin|simpan|pindahkan|ekspor|rangkum(?:kan)?|taruh|post)\s+(?:.*?\s+)?(?:ke|di|pada)\s+(?:google\s+)?(?:docs?|dokumen|document|gdocs?)|(?:ke|di|pada)\s+(?:google\s+)?(?:docs?|dokumen|document|gdocs?)|(?:buka|open)\s+(?:google\s+)?(?:docs?|dokumen|document)|docs\.new)/i.test(prompt);

  assert.equal(isExplicitNavigateDocs('Kunjungi https://id.wikipedia.org/wiki/Kecerdasan_buatan dan buat rangkuman nya ke google document'), true);
  assert.equal(isExplicitNavigateDocs('tolong rangkum halaman ini ke google docs'), true);
  assert.equal(isExplicitNavigateDocs('buatkan artikel AI lalu masukkan ke gdocs'), true);
  assert.equal(isExplicitNavigateDocs('simpan ringkasan di google document'), true);
  assert.equal(isExplicitNavigateDocs('jelaskan sejarah kemerdekaan Indonesia'), false);
});

test('resolveSourceUrlFromPrompt: accurately extracts target URL from natural user prompts', () => {
  function resolveSourceUrlFromPrompt(prompt = "") {
    const directUrlMatch = prompt.match(/https?:\/\/[^\s`"']+/i);
    if (directUrlMatch) return directUrlMatch[0];

    const domainMatch = prompt.match(/\b([a-zA-Z0-9-]+\.(?:com|org|id|net|io|co\.id|gov|edu)(?:\/[^\s`"']*)?)\b/i);
    if (domainMatch) return "https://" + domainMatch[1];

    const wikiSearch = prompt.match(/wikipedia.*?(?:cari|tentang|topik|artikel|baca)\s+["'“]?([^.,'”\n]+?)["'”]?[\.,\s]+(?:lalu|kemudian|setelah|dan|rangkum|ke|$)/i) ||
                       prompt.match(/wikipedia.*?(?:cari|tentang|topik|artikel|baca)\s+["'“]?([^.,'”\n]+)/i);
    if (wikiSearch && wikiSearch[1].trim()) {
      const q = wikiSearch[1].trim().replace(/^(?:tentang|artikel)\s+/i, "").trim();
      if (q) return "https://id.wikipedia.org/wiki/" + encodeURIComponent(q.replace(/\s+/g, "_"));
    }
    if (/(?:kuni?jungi|buka|ke|akses)\s+wikipedia/i.test(prompt)) {
      return "https://id.wikipedia.org";
    }

    const googleSearchMatch = prompt.match(/(?:cari\s+(?:di\s+)?google|search\s+google)\s+(?:tentang\s+)?["'“]?([^.'"“”\n]+)["'”]?/i);
    if (googleSearchMatch && googleSearchMatch[1].trim()) {
      return "https://www.google.com/search?q=" + encodeURIComponent(googleSearchMatch[1].trim());
    }

    return null;
  }

  assert.equal(resolveSourceUrlFromPrompt('Kunijungi wikipedia dan cari kecerdasan buatan. Setelah itu rangkum ke google document'), 'https://id.wikipedia.org/wiki/kecerdasan_buatan');
  assert.equal(resolveSourceUrlFromPrompt('Kunjungi https://id.wikipedia.org/wiki/Kecerdasan_buatan dan buat rangkuman nya ke google document'), 'https://id.wikipedia.org/wiki/Kecerdasan_buatan');
  assert.equal(resolveSourceUrlFromPrompt('Buka wikipedia.org lalu cari Machine Learning'), 'https://wikipedia.org');
  assert.equal(resolveSourceUrlFromPrompt('cari di google tren AI 2026'), 'https://www.google.com/search?q=tren%20AI%202026');
  assert.equal(resolveSourceUrlFromPrompt('buatkan draf artikel tentang kesehatan'), null);
});
