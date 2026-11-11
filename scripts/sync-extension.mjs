// scripts/sync-extension.mjs
// Otomasi sinkronisasi berkas runtime dari root ke direktori distribusi extension/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const extDir = path.resolve(rootDir, "extension");

const filesToSync = [
  "manifest.json",
  "background.js",
  "content.js",
  "logger.js",
  "config.js",
  "api-client.js",
  "ai-engine.js",
  "agent-engine.js",
  "context-engine.js",
  "file-engine.js",
  "memory-engine.js"
];

const dirsToSync = [
  "sidepanel",
  "skills",
  "icons"
];

function copyFolderRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log("🔄 Sinkronisasi berkas runtime ke extension/ ...");

if (!fs.existsSync(extDir)) {
  fs.mkdirSync(extDir, { recursive: true });
}

for (const file of filesToSync) {
  const src = path.join(rootDir, file);
  const dest = path.join(extDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${file}`);
  }
}

for (const dir of dirsToSync) {
  const src = path.join(rootDir, dir);
  const dest = path.join(extDir, dir);
  if (fs.existsSync(src)) {
    copyFolderRecursive(src, dest);
    console.log(`  ✓ ${dir}/`);
  }
}

console.log("✅ Sinkronisasi berhasil tuntas!");
