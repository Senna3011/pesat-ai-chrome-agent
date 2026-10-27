const test = require('node:test');
const assert = require('node:assert/strict');

// Cermin logika parseGoogleDocsSubtabs() di content.js (diuji tanpa DOM peramban).
function parseGoogleDocsSubtabsLogic({ href, pathname, title, domTabs = [] }) {
  const isDocs = href.includes('docs.google.com') && pathname.includes('/document/d/');
  if (!isDocs) return null;

  const docIdMatch = pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  const docId = docIdMatch ? docIdMatch[1] : null;
  const docTitle = (title || 'Dokumen Google Docs').replace(/\s*-\s*Google (?:Docs|Dokumen)\s*$/i, '').trim();

  // 1. Prioritas: ID tab dari URL (Google Docs menulisnya saat berpindah tab)
  const urlTabMatch = href.match(/[?&#]tab=(t\.[A-Za-z0-9_-]+)/);
  let activeTabId = urlTabMatch ? urlTabMatch[1] : '';
  let activeTabTitle = '';

  // 2. DOM: hanya elemen dengan ID tab t.* yang dianggap tab dokumen.
  //    .navigation-item / outline heading sengaja tidak dipakai (sumber salah-deteksi "Tab 1").
  const allSubtabs = [];
  for (const tab of domTabs) {
    const tId = /^t\.[A-Za-z0-9_-]+$/.test(tab.id || '') ? tab.id : '';
    if (!tId) continue;
    const isSelected = !!tab.isSelected;
    const tTitle = tab.title || '';
    if (tTitle && !allSubtabs.some((s) => s.id === tId)) {
      allSubtabs.push({ id: tId, title: tTitle, isSelected });
    }
  }

  if (!activeTabId) {
    const selectedEl = allSubtabs.find((s) => s.isSelected);
    if (selectedEl) {
      activeTabId = selectedEl.id;
      activeTabTitle = selectedEl.title;
    }
  }

  if (!activeTabTitle && activeTabId) {
    const found = allSubtabs.find((s) => s.id === activeTabId);
    if (found) activeTabTitle = found.title;
  }
  if (!activeTabTitle) {
    activeTabTitle = activeTabId ? `Subtab ${activeTabId}` : 'Tidak terdeteksi';
  }

  const subtabsSummary = allSubtabs.length > 0
    ? allSubtabs.map((s) => `${s.title}${s.isSelected || s.id === activeTabId ? ' (AKTIF)' : ''}`).join(', ')
    : activeTabTitle;

  return { docId, docTitle, activeTabId, activeTabTitle, allSubtabs, subtabsSummary };
}

// Cermin logika tabTextMatchesTitle() di content.js
function tabTextMatchesTitleLogic(text, title) {
  if (!text || !title || title === 'Tidak terdeteksi') return true;
  const key = title.replace(/^(?:Tab|Subtab)\s*\d+\s*[-–:.]?\s*/i, '').trim().toLowerCase();
  if (key.length < 4) return true;
  const probe = key.split(/\s+/).slice(0, 3).join(' ');
  return text.toLowerCase().includes(probe);
}

test('Google Docs subtabs: parses active Tab 6 from URL parameter', () => {
  const result = parseGoogleDocsSubtabsLogic({
    href: 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?tab=t.tab6id',
    pathname: '/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
    title: 'Laporan Eksekutif - Google Docs',
    domTabs: [
      { id: 't.0', title: 'Ringkasan Utama', isSelected: false },
      { id: 't.tab6id', title: 'Analisis Risiko Finansial (Tab 6)', isSelected: true }
    ]
  });

  assert.ok(result);
  assert.equal(result.docId, '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  assert.equal(result.docTitle, 'Laporan Eksekutif');
  assert.equal(result.activeTabId, 't.tab6id');
  assert.equal(result.activeTabTitle, 'Analisis Risiko Finansial (Tab 6)');
  assert.match(result.subtabsSummary, /Analisis Risiko Finansial \(Tab 6\) \(AKTIF\)/);
});

test('Google Docs subtabs: URL tab id wins over a wrongly-selected DOM tab', () => {
  // Regresi bug nyata: sidebar sempat menandai Tab 1 sebagai selected saat layar di Tab 6.
  const result = parseGoogleDocsSubtabsLogic({
    href: 'https://docs.google.com/document/d/abc123xyz/edit?tab=t.garuda6',
    pathname: '/document/d/abc123xyz/edit',
    title: 'BAHAN UJI - Google Docs',
    domTabs: [
      { id: 't.0', title: 'Tab 1 - PT Nusantara Logam', isSelected: true },
      { id: 't.garuda6', title: 'Tab 6 - PT Garuda Semesta', isSelected: false }
    ]
  });

  assert.equal(result.activeTabId, 't.garuda6');
  assert.equal(result.activeTabTitle, 'Tab 6 - PT Garuda Semesta');
  assert.notEqual(result.activeTabTitle, 'Tab 1 - PT Nusantara Logam');
});

test('Google Docs subtabs: falls back to DOM selection when URL has no tab param', () => {
  const result = parseGoogleDocsSubtabsLogic({
    href: 'https://docs.google.com/document/d/abc-123_xyz/edit',
    pathname: '/document/d/abc-123_xyz/edit',
    title: 'Perencanaan Strategis 2026 - Google Dokumen',
    domTabs: [
      { id: 't.0', title: 'Subtab 1 - Pengantar', isSelected: false },
      { id: 't.sub2', title: 'Subtab 2 - Visi Misi', isSelected: false },
      { id: 't.sub6', title: 'Subtab 6 - Rekomendasi Taktis', isSelected: true }
    ]
  });

  assert.equal(result.activeTabId, 't.sub6');
  assert.equal(result.activeTabTitle, 'Subtab 6 - Rekomendasi Taktis');
  assert.match(result.subtabsSummary, /Subtab 6 - Rekomendasi Taktis \(AKTIF\)/);
  assert.doesNotMatch(result.subtabsSummary, /Subtab 1 - Pengantar \(AKTIF\)/);
});

test('Google Docs subtabs: outline nodes without tab ids are never treated as document tabs', () => {
  // .navigation-item adalah heading outline, bukan tab. Ini sumber "Tab 1" palsu.
  const result = parseGoogleDocsSubtabsLogic({
    href: 'https://docs.google.com/document/d/abc123/edit',
    pathname: '/document/d/abc123/edit',
    title: 'Dokumen - Google Docs',
    domTabs: [
      { id: '', title: 'Tab 1 - PT Nusantara Logam', isSelected: true },
      { id: 'outline-h2', title: 'Pendahuluan', isSelected: false }
    ]
  });

  assert.equal(result.allSubtabs.length, 0);
  assert.equal(result.activeTabId, '');
  assert.equal(result.activeTabTitle, 'Tidak terdeteksi');
});

test('Google Docs subtabs: no tab id detected is reported honestly, not as Tab 1', () => {
  const result = parseGoogleDocsSubtabsLogic({
    href: 'https://docs.google.com/document/d/abc123/edit',
    pathname: '/document/d/abc123/edit',
    title: 'BAHAN UJI - Google Docs',
    domTabs: [{ id: 't.0', title: 'Tab 1 - PT Nusantara Logam', isSelected: false }]
  });

  assert.equal(result.activeTabId, '');
  assert.notEqual(result.activeTabTitle, 'Tab 1 - PT Nusantara Logam');
});

test('Google Docs subtabs: text verification detects mismatched tab content', () => {
  const tab6Text = 'Tab 6 - PT Garuda Semesta\nPendapatan Tahunan Rp 1,45 triliun\nGDS-TAB6-ALPHA';
  const tab1Text = 'Tab 1 - PT Nusantara Logam\nPendapatan Tahunan Rp 120 miliar';

  assert.equal(tabTextMatchesTitleLogic(tab6Text, 'Tab 6 - PT Garuda Semesta'), true);
  // Isi Tab 1 diberikan dengan label Tab 6 -> harus terdeteksi tidak cocok
  assert.equal(tabTextMatchesTitleLogic(tab1Text, 'Tab 6 - PT Garuda Semesta'), false);
});

test('Google Docs subtabs: ignores non-Google Docs websites', () => {
  const result = parseGoogleDocsSubtabsLogic({
    href: 'https://wikipedia.org/wiki/Artificial_intelligence',
    pathname: '/wiki/Artificial_intelligence',
    title: 'Artificial Intelligence - Wikipedia'
  });

  assert.equal(result, null);
});
