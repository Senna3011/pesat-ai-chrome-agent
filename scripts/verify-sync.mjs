#!/usr/bin/env node
/**
 * Gate sinkronisasi: gagalkan kalau sumber dan folder runtime tidak identik.
 * Dipanggil setelah setiap fase sebelum laporan disampaikan.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const pairs = [
  ['manifest.json', 'extension/manifest.json'],
  ['ai-engine.js', 'extension/ai-engine.js'],
  ['sidepanel/sidepanel.css', 'extension/sidepanel/sidepanel.css'],
  ['sidepanel/sidepanel.html', 'extension/sidepanel/sidepanel.html'],
  ['sidepanel/sidepanel.js', 'extension/sidepanel/sidepanel.js'],
];

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

let failed = 0;
for (const [src, dst] of pairs) {
  const a = join(root, src);
  const b = join(root, dst);
  if (!existsSync(b)) {
    console.error(`  ✗ ${dst} tidak ada — jalankan: npm run sync`);
    failed++;
    continue;
  }
  if (sha(a) !== sha(b)) {
    console.error(`  ✗ ${src} ≠ ${dst} — jalankan: npm run sync`);
    failed++;
  } else {
    console.log(`  ✓ ${dst}`);
  }
}

if (failed) {
  console.error(`\nGAGAL: ${failed} file belum sinkron.`);
  process.exit(1);
}
console.log('\nSinkronisasi terverifikasi. Ekstensi akan tampil benar setelah reload.');
