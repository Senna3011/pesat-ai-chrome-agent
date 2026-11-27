// source-resolver.js - Pesat AI Browser Agent
// Modul bersama (shared) resolusi URL sumber dari prompt bahasa natural.
// Dipakai baik oleh sidepanel (runtime) maupun unit test produksi (Node),
// sehingga logika "dapur" (termasuk portal berita Indonesia) identik & dapat diuji.
//
// Dimuat sebagai <script> di sidepanel.html (mengisi globalThis.PesatSourceResolver)
// dan sebagai CommonJS module (module.exports) saat di-require oleh node --test.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PesatSourceResolver = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Resolusi deterministik URL target dari prompt.
  // Urutan: (1) URL eksplisit -> (2) domain ber-TLD -> (3) portal berita/media
  // -> (4) Wikipedia (+mode pencarian) -> (5) Pencarian Google.
  function resolveSourceUrlFromPrompt(prompt = "") {
    let resolvedUrl = null;
    const text = String(prompt || "");

    // 1. URL eksplisit (https://... atau http://...)
    const directUrlMatch = text.match(/https?:\/\/[^\s`"']+/i);
    if (directUrlMatch) {
      resolvedUrl = directUrlMatch[0];
    } else {
      // 2. Domain dengan TLD (wikipedia.org, detik.com, kompas.com, dll)
      const domainMatch = text.match(/\b([a-zA-Z0-9-]+\.(?:com|org|id|net|io|co\.id|gov|edu)(?:\/[^\s`"']*)?)\b/i);
      if (domainMatch) {
        resolvedUrl = "https://" + domainMatch[1];
      } else {
        // 3. Portal Berita & Media Populer Indonesia (resolusi URL pencarian deterministik)
        const mediaPortals = [
          { pattern: /\b(?:cnn\s*indonesia|cnn)\b/i, home: "https://www.cnnindonesia.com", search: "https://www.cnnindonesia.com/search/?query=" },
          { pattern: /\b(?:detik(?:\.com)?|detikcom|detiknews)\b/i, home: "https://www.detik.com", search: "https://www.detik.com/search/searchall?query=" },
          { pattern: /\b(?:kompas(?:\.com)?|kompascom)\b/i, home: "https://www.kompas.com", search: "https://search.kompas.com/search/?q=" },
          { pattern: /\b(?:tribun(?:\s*news)?|tribunnews)\b/i, home: "https://www.tribunnews.com", search: "https://www.tribunnews.com/search?q=" },
          { pattern: /\bkumparan\b/i, home: "https://kumparan.com", search: "https://kumparan.com/search/" },
          { pattern: /\btempo(?:\.co)?\b/i, home: "https://www.tempo.co", search: "https://www.tempo.co/search?q=" },
          { pattern: /\bliputan6\b/i, home: "https://www.liputan6.com", search: "https://www.liputan6.com/search?q=" },
          { pattern: /\b(?:antara|antaranews)\b/i, home: "https://www.antaranews.com", search: "https://www.antaranews.com/search?q=" },
          { pattern: /\b(?:cnbc\s*indonesia|cnbc)\b/i, home: "https://www.cnbcindonesia.com", search: "https://www.cnbcindonesia.com/search?query=" },
          { pattern: /\bjawapos\b/i, home: "https://www.jawapos.com", search: "https://www.jawapos.com/?s=" },
          { pattern: /\bsindo(?:news)?\b/i, home: "https://www.sindonews.com", search: "https://search.sindonews.com/search?q=" },
          { pattern: /\bviva(?:\.co\.id)?\b/i, home: "https://www.viva.co.id", search: "https://www.viva.co.id/search?q=" },
          { pattern: /\btirto(?:\.id)?\b/i, home: "https://tirto.id", search: "https://tirto.id/search?q=" },
          // Situs e-commerce / marketplace Indonesia
          { pattern: /\btokopedia\b/i, home: "https://www.tokopedia.com", search: "https://www.tokopedia.com/search?q=" },
          { pattern: /\bshopee(?:\.co\.id)?\b/i, home: "https://shopee.co.id", search: "https://shopee.co.id/search?keyword=" },
          { pattern: /\blazada\b/i, home: "https://www.lazada.co.id", search: "https://www.lazada.co.id/catalog/?q=" },
          { pattern: /\bbukalapak\b/i, home: "https://www.bukalapak.com", search: "https://www.bukalapak.com/cari?q=" },
          { pattern: /\btik(?:tok)?\s*shop\b/i, home: "https://www.tiktok.com/shop", search: "https://www.tiktok.com/search?q=" }
        ];

        const matchedPortal = mediaPortals.find(p => p.pattern.test(text));
        if (matchedPortal) {
          const searchMatch = text.match(/(?:cari|search|temukan|baca|list|lihat|tampilkan|cari\s+di)\s+(?:berita\s+|informasi\s+|artikel\s+|kabar\s+|produk\s+|list\s+)?(?:tentang\s+|mengenai\s+|soal\s+)?["'“]?([^.,'”\n]+?)["'”]?[\.,\s]*(?:lalu|kemudian|setelah|dan|$)/i) ||
                              text.match(/(?:tentang|mengenai|soal)\s+["'“]?([^.,'”\n]+?)["'”]?[\.,\s]*(?:lalu|kemudian|setelah|dan|$)/i);
          let rawQuery = searchMatch ? searchMatch[1].trim() : "";
          // Bersihkan kotoran agar query fokus ke topik inti:
          // - buang kata pembuka (berita/informasi/terbaru/tentang, dst.)
          // - buang ekor "di/ke/dari [berita] <nama portal>" (mis. "gibran di cnn" -> "gibran")
          rawQuery = rawQuery
            .replace(/^(?:(?:berita|informasi|info|artikel|kabar|tentang|mengenai|soal|terbaru|terkini|terhangat|update)\s+)+/i, "")
            .replace(/\s+(?:di|ke|pada|dari|via|melalui)\s+(?:berita\s+|informasi\s+|info\s+|artikel\s+|kabar\s+)?(?:cnn(?:\s*indonesia)?|detik(?:\.com)?|detikcom|kompas(?:\.com)?|kompascom|tribun(?:\s*news)?|tribunnews|kumparan|tempo(?:\.co)?|liputan6|antara|antaranews|cnbc(?:\s*indonesia)?|jawapos|sindo(?:news)?|viva(?:\.co\.id)?|tirto(?:\.id)?|google|bing|wikipedia)\s*$/i, "")
            .replace(/[.,;:]+$/g, "")
            .trim();
          if (rawQuery && rawQuery.length > 1) {
            resolvedUrl = matchedPortal.search + encodeURIComponent(rawQuery);
          } else {
            resolvedUrl = matchedPortal.home;
          }
        } else {
          // 4. Situs Wikipedia + kueri pencarian
          const wikiSearch = text.match(/wikipedia.*?(?:cari|tentang|topik|artikel|baca)\s+["'“]?([^.,'”\n]+?)["'”]?[\.,\s]+(?:lalu|kemudian|setelah|dan|rangkum|ke|$)/i) ||
                             text.match(/wikipedia.*?(?:cari|tentang|topik|artikel|baca)\s+["'“]?([^.,'”\n]+)/i);
          if (wikiSearch && wikiSearch[1].trim()) {
            const q = wikiSearch[1].trim().replace(/^(?:tentang|artikel)\s+/i, "").trim();
            if (q) resolvedUrl = "https://id.wikipedia.org/wiki/" + encodeURIComponent(q.replace(/\s+/g, "_"));
          } else if (/(?:kuni?jungi|buka|ke|akses)\s+wikipedia/i.test(text)) {
            resolvedUrl = "https://id.wikipedia.org";
          } else {
            // 5. Pencarian umum di Google
            const googleSearchMatch = text.match(/(?:cari\s+(?:di\s+)?google|search\s+google)\s+(?:tentang\s+)?["'“]?([^.'"“”\n]+)["'”]?/i);
            if (googleSearchMatch && googleSearchMatch[1].trim()) {
              resolvedUrl = "https://www.google.com/search?q=" + encodeURIComponent(googleSearchMatch[1].trim());
            }
          }
        }
      }
    }

    if (!resolvedUrl) return null;

    try {
      const parsed = new URL(resolvedUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return null;
      }
      return parsed.href;
    } catch (_) {
      return null;
    }
  }

  // Registry terkurasi topik -> sumber resmi/berita tepercaya (deterministik).
  const TOPIC_SOURCES = [
    {
      pattern: /\b(ekonomi|economy|global economy|investasi|investment|bank sentral|fed|the fed)\b/i,
      sources: [
        { name: "IMF", url: "https://www.imf.org", kind: "official" },
        { name: "World Bank", url: "https://www.worldbank.org", kind: "official" },
        { name: "Bank Indonesia", url: "https://www.bi.go.id", kind: "official" },
        { name: "Reuters Business", url: "https://www.reuters.com/business/", kind: "news" },
        { name: "Bloomberg", url: "https://www.bloomberg.com", kind: "news" }
      ]
    },
    {
      pattern: /\b(saham|stock|stocks|pasar modal|capital market|idx|investasi saham)\b/i,
      sources: [
        { name: "IDX (Bursa Efek Indonesia)", url: "https://www.idx.co.id", kind: "official" },
        { name: "Yahoo Finance", url: "https://finance.yahoo.com", kind: "news" },
        { name: "Investing.com", url: "https://www.investing.com", kind: "news" }
      ]
    },
    {
      pattern: /\b(kripto|crypto|cryptocurrency|bitcoin|btc|ethereum|eth)\b/i,
      sources: [
        { name: "CoinMarketCap", url: "https://coinmarketcap.com", kind: "news" },
        { name: "CoinGecko", url: "https://www.coingecko.com", kind: "news" },
        { name: "Bappebti", url: "https://www.bappebti.go.id", kind: "official" }
      ]
    },
    {
      pattern: /\b(teknologi|technology|ai|artificial intelligence|gadget|smartphone)\b/i,
      sources: [
        { name: "The Verge", url: "https://www.theverge.com", kind: "news" },
        { name: "TechCrunch", url: "https://techcrunch.com", kind: "news" },
        { name: "Ars Technica", url: "https://arstechnica.com", kind: "news" }
      ]
    },
    {
      pattern: /\b(kesehatan|health|medis|medical|penyakit|disease|who)\b/i,
      sources: [
        { name: "WHO", url: "https://www.who.int", kind: "official" },
        { name: "Kemenkes RI", url: "https://www.kemkes.go.id", kind: "official" },
        { name: "CDC", url: "https://www.cdc.gov", kind: "official" }
      ]
    },
    {
      pattern: /\b(cuaca|weather|iklim|climate|bmkg)\b/i,
      sources: [
        { name: "BMKG", url: "https://www.bmkg.go.id", kind: "official" },
        { name: "Weather.com", url: "https://weather.com", kind: "news" }
      ]
    },
    {
      pattern: /\b(olahraga|sport|sports|sepak bola|football|basket|nba|premier league)\b/i,
      sources: [
        { name: "ESPN", url: "https://www.espn.com", kind: "news" },
        { name: "Bola.com", url: "https://www.bola.com", kind: "news" },
        { name: "FIFA", url: "https://www.fifa.com", kind: "official" }
      ]
    },
    {
      pattern: /\b(politik|politik indonesia|politik global|government|pemerintah|presiden|election|pemilu)\b/i,
      sources: [
        { name: "ANTARA News", url: "https://www.antaranews.com", kind: "news" },
        { name: "Reuters World", url: "https://www.reuters.com/world/", kind: "news" },
        { name: "Setkab RI", url: "https://setkab.go.id", kind: "official" }
      ]
    }
  ];

  const GENERIC_NEWS_SOURCES = [
    { name: "Reuters", url: "https://www.reuters.com", kind: "news" },
    { name: "Associated Press", url: "https://apnews.com", kind: "news" },
    { name: "BBC News", url: "https://www.bbc.com/news", kind: "news" },
    { name: "ANTARA News", url: "https://www.antaranews.com", kind: "news" }
  ];

  // Resolusi sumber resmi/berita terkurasi berdasarkan topik pada prompt.
  function resolveOfficialSources(prompt = "") {
    const text = String(prompt || "");
    const matched = TOPIC_SOURCES.find(t => t.pattern.test(text));
    const list = matched ? matched.sources.slice() : GENERIC_NEWS_SOURCES.slice();
    return list.map(s => ({ name: s.name, url: s.url, kind: s.kind }));
  }

  // Bersihkan URL dari parameter pelacak (utm_*, fbclid, gclid, dsb).
  function cleanUrl(url = "") {
    const raw = String(url || "").trim();
    if (!raw) return "";
    try {
      const u = new URL(raw);
      if (!["http:", "https:"].includes(u.protocol)) return "";
      const drop = [];
      for (const key of Array.from(u.searchParams.keys())) {
        const lower = key.toLowerCase();
        if (lower.startsWith("utm_") || lower === "fbclid" || lower === "gclid" ||
            lower === "ref" || lower === "ref_src" || lower === "igshid" ||
            lower === "mc_cid" || lower === "mc_eid" || lower === "yclid") {
          drop.push(key);
        }
      }
      drop.forEach(k => u.searchParams.delete(k));
      u.hash = "";
      return u.href;
    } catch (_) {
      return "";
    }
  }

  // Bangun markdown daftar sumber dengan tag [Resmi]/[Live].
  function buildSourcesMarkdown(list = []) {
    const items = (Array.isArray(list) ? list : [])
      .map(s => ({ name: String(s?.name || "").trim(), url: cleanUrl(s?.url), kind: s?.kind === "official" ? "Resmi" : "Live" }))
      .filter(s => s.name && s.url);
    if (!items.length) return "";
    const lines = items.map(s => `- [${s.name}](${s.url}) [${s.kind}]`);
    return "## Sources\n" + lines.join("\n");
  }

  return { resolveSourceUrlFromPrompt, resolveOfficialSources, cleanUrl, buildSourcesMarkdown };
});