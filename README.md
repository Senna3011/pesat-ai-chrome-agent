# Pesat AI Browser Agent

Chrome Extension Manifest V3 dengan typed browser-agent loop dan backend RAG Cloudflare-native.

## Struktur

- `extension/`: source canonical Chrome Extension.
- `worker/` + `index.mjs`: Cloudflare Worker canonical.
- `migrations/`: schema D1.
- `functions/`: Pages Functions lama; tidak dipakai deployment canonical baru.

## Menjalankan extension

1. Buka `chrome://extensions/`.
2. Aktifkan **Developer mode**.
3. Klik **Load unpacked** dan pilih `extension/`.
4. Isi PesatRouter API key, atau hubungkan Google untuk authenticated Worker fallback dan knowledge base.

## Provisioning backend RAG

Resource yang dibutuhkan:

```bash
npx wrangler d1 create pesat-agent
npx wrangler r2 bucket create pesat-originals
npx wrangler r2 bucket create pesat-artifacts
npx wrangler vectorize create pesat-knowledge --dimensions=1024 --metric=cosine
npx wrangler vectorize create-metadata-index pesat-knowledge --property-name=tenant_id --type=string
npx wrangler vectorize create-metadata-index pesat-knowledge --property-name=source_type --type=string
```

`1024` harus sama dengan dimensi `EMBEDDING_MODEL`. Bila model diganti, buat index dengan dimensi model tersebut.

Isi `wrangler.jsonc`:

- D1 `database_id` nyata.
- `ALLOWED_EXTENSION_ID` atau exact `ALLOWED_ORIGINS`.
- `GOOGLE_OAUTH_CLIENT_IDS`: allowlist OAuth client ID yang boleh menukar Google token menjadi session.

Set secrets:

```bash
npx wrangler secret put SESSION_SECRET
# Opsional bila memakai provider eksternal:
npx wrangler secret put CHAT_API_KEY
npx wrangler secret put EMBEDDING_API_KEY
```

Terapkan schema dan validasi:

```bash
npx wrangler d1 migrations apply pesat-agent --remote
npm run validate:deploy
npx wrangler deploy --dry-run
npx wrangler deploy
```

`npm run validate:deploy` sengaja gagal selama placeholder deployment belum diganti.

## Batas ingestion sinkron

Versi ini menerima teks/Markdown/HTML/CSV sampai 48 KiB dan maksimum 40 chunks per request. File besar memerlukan durable asynchronous ingestion sebelum batas dinaikkan.

## Tests

```bash
node --test tests/agent-core.test.js tests/knowledge-skill.test.js tests/backend/*.test.mjs
npm test -- --reporter=line
```
