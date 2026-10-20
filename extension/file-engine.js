// file-engine.js - File Processing Engine for Prompt Attachments
(() => {
  const PesatFileEngine = {
    async processLocalFile(file) {
      if (!file) throw new Error("File tidak ditemukan");

      const name = file.name || "file";
      const size = file.size || 0;
      const type = file.type || "";
      const ext = name.split(".").pop().toLowerCase();

      if (size > 10 * 1024 * 1024) {
        throw new Error(`File ${name} melebihi batas 10MB.`);
      }

      if (
        ["txt", "md", "json", "js", "ts", "html", "css", "py", "sql"].includes(ext) ||
        type.startsWith("text/") ||
        type === "application/json"
      ) {
        const text = await this.readAsText(file);
        return {
          name,
          size,
          ext,
          type: "text",
          content: text
        };
      }

      if (ext === "csv") {
        const text = await this.readAsText(file);
        const mdTable = this.parseCsvToMarkdown(text);
        return {
          name,
          size,
          ext,
          type: "spreadsheet",
          content: `[TABEL CSV: ${name}]\n\n${mdTable}`
        };
      }

      if (ext === "xlsx" || ext === "xls") {
        try {
          const arrayBuf = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          const rawStr = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          const tMatches = rawStr.match(/<t[^>]*>([^<]+)<\/t>/g);
          if (tMatches && tMatches.length > 0) {
            const cells = tMatches.map(m => m.replace(/<t[^>]*>|<\/t>/g, "").trim()).filter(Boolean);
            return {
              name,
              size,
              ext,
              type: "spreadsheet",
              content: `[DATA SPREADSHEET XLSX: ${name}]\n\n` + cells.slice(0, 300).join(" | ")
            };
          }
        } catch (_) {}
      }

      if (ext === "pdf") {
        const pdfContent = await this.parsePdfFile(file);
        return {
          name,
          size,
          ext,
          type: "document",
          content: pdfContent
        };
      }

      if (ext === "docx" || ext === "doc") {
        const docxContent = await this.parseDocxFile(file);
        return {
          name,
          size,
          ext,
          type: "document",
          content: docxContent
        };
      }

      if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || type.startsWith("image/")) {
        const dataUrl = await this.readAsDataURL(file);
        return {
          name,
          size,
          ext,
          type: "image",
          dataUrl: dataUrl,
          content: `[Gambar Lampiran: ${name} (${Math.round(size / 1024)} KB)]`
        };
      }

      try {
        const text = await this.readAsText(file);
        return {
          name,
          size,
          ext,
          type: "document",
          content: text || `[Dokumen: ${name}]`
        };
      } catch (_) {
        return {
          name,
          size,
          ext,
          type: "binary",
          content: `[File Lampiran: ${name} (${Math.round(size / 1024)} KB)]`
        };
      }
    },

    parseCsvToMarkdown(csvText) {
      if (!csvText) return "";
      const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (!lines.length) return "";
      return lines.map((line, idx) => {
        const cells = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const rowStr = "| " + cells.join(" | ") + " |";
        if (idx === 0) {
          const sepStr = "| " + cells.map(() => "---").join(" | ") + " |";
          return rowStr + "\n" + sepStr;
        }
        return rowStr;
      }).join("\n");
    },

    async decompressStreamBytes(uint8Array) {
      if (typeof DecompressionStream === "undefined" || !uint8Array || uint8Array.length === 0) return null;
      for (const format of ["deflate", "deflate-raw"]) {
        try {
          const ds = new DecompressionStream(format);
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          const p = writer.write(uint8Array).then(() => writer.close()).catch(() => {});
          const chunks = [];
          let err = false;
          while (true) {
            try {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            } catch (_) { err = true; break; }
          }
          await p;
          if (!err && chunks.length > 0) {
            const total = chunks.reduce((a, c) => a + c.length, 0);
            const out = new Uint8Array(total);
            let pos = 0;
            for (const c of chunks) { out.set(c, pos); pos += c.length; }
            return out;
          }
        } catch (_) {}
      }
      return null;
    },

    findSubarray(bytes, pattern, startIndex = 0) {
      for (let i = startIndex; i <= bytes.length - pattern.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
          if (bytes[i + j] !== pattern[j]) { match = false; break; }
        }
        if (match) return i;
      }
      return -1;
    },

    parseCMap(cmapStr) {
      const map = new Map();
      const bfCharRegex = /beginbfchar\r?\n([\s\S]*?)\r?\nendbfchar/g;
      let m;
      while ((m = bfCharRegex.exec(cmapStr)) !== null) {
        const lines = m[1].trim().split(/\r?\n/);
        for (const line of lines) {
          const pair = line.trim().match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
          if (pair) {
            const srcCode = parseInt(pair[1], 16);
            let uStr = "";
            const dstHex = pair[2];
            for (let k = 0; k < dstHex.length; k += 4) {
              const uCode = parseInt(dstHex.slice(k, k + 4), 16);
              if (!isNaN(uCode)) uStr += String.fromCodePoint(uCode);
            }
            map.set(srcCode, uStr);
          }
        }
      }
      const bfRangeRegex = /beginbfrange\r?\n([\s\S]*?)\r?\nendbfrange/g;
      while ((m = bfRangeRegex.exec(cmapStr)) !== null) {
        const lines = m[1].trim().split(/\r?\n/);
        for (const line of lines) {
          const parts = line.trim().match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
          if (parts) {
            const start = parseInt(parts[1], 16);
            const end = parseInt(parts[2], 16);
            let target = parseInt(parts[3], 16);
            for (let code = start; code <= end; code++) {
              map.set(code, String.fromCodePoint(target));
              target++;
            }
          }
        }
      }
      return map;
    },

    decodePdfLiteral(s) {
      return s.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
              .replace(/\\([nrtbf()\\\\])/g, (_, c) => {
                if (c === "n") return "\n";
                if (c === "r") return "\r";
                if (c === "t") return "\t";
                if (c === "b") return "\b";
                if (c === "f") return "\f";
                return c;
              });
    },

    decodePdfHex(hex, cmaps) {
      let cleanHex = hex.trim();
      if (cleanHex.length % 2 !== 0) cleanHex += "0";
      let decoded = "";

      let i = 0;
      while (i < cleanHex.length) {
        let matched = false;
        if (i + 4 <= cleanHex.length && cmaps.length > 0) {
          const code4 = parseInt(cleanHex.slice(i, i + 4), 16);
          for (const cmap of cmaps) {
            if (cmap.has(code4)) {
              decoded += cmap.get(code4);
              matched = true;
              i += 4;
              break;
            }
          }
        }
        if (!matched && i + 2 <= cleanHex.length && cmaps.length > 0) {
          const code2 = parseInt(cleanHex.slice(i, i + 2), 16);
          for (const cmap of cmaps) {
            if (cmap.has(code2)) {
              decoded += cmap.get(code2);
              matched = true;
              i += 2;
              break;
            }
          }
        }
        if (!matched) {
          if (i + 4 <= cleanHex.length && cleanHex.startsWith("00", i)) {
            const code = parseInt(cleanHex.slice(i + 2, i + 4), 16);
            if (code >= 32 && code <= 126) decoded += String.fromCharCode(code);
            i += 4;
          } else {
            const code = parseInt(cleanHex.slice(i, i + 2), 16);
            if (code >= 32 && code <= 126) decoded += String.fromCharCode(code);
            i += 2;
          }
        }
      }
      return decoded;
    },

    extractTextFromContentStream(streamStr, cmaps) {
      const extracted = [];

      const tjLitRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
      let m;
      while ((m = tjLitRegex.exec(streamStr)) !== null) {
        const dec = this.decodePdfLiteral(m[1]).trim();
        if (dec) extracted.push(dec);
      }

      const tjHexRegex = /<([0-9a-fA-F]+)>\s*(?:Tj|'|")/g;
      while ((m = tjHexRegex.exec(streamStr)) !== null) {
        const dec = this.decodePdfHex(m[1], cmaps).trim();
        if (dec) extracted.push(dec);
      }

      const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
      while ((m = tjArrayRegex.exec(streamStr)) !== null) {
        const inner = m[1];
        let piece = "";
        const tokenRegex = /\(([\s\S]*?)\)|<([0-9a-fA-F]+)>|(-?\d+(?:\.\d+)?)/g;
        let tm;
        while ((tm = tokenRegex.exec(inner)) !== null) {
          if (tm[1] !== undefined) {
            piece += this.decodePdfLiteral(tm[1]);
          } else if (tm[2] !== undefined) {
            piece += this.decodePdfHex(tm[2], cmaps);
          } else if (tm[3] !== undefined) {
            const spacing = parseFloat(tm[3]);
            if (spacing < -150) piece += " ";
          }
        }
        if (piece.trim()) extracted.push(piece.trim());
      }

      return extracted;
    },

    async parsePdfFile(file) {
      try {
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        const decoder = new TextDecoder("latin1");

        const STREAM_BYTES = [0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]; // "stream"
        const ENDSTREAM_BYTES = [0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]; // "endstream"

        let pos = 0;
        const decompressedStreams = [];
        while (true) {
          const sIdx = this.findSubarray(bytes, STREAM_BYTES, pos);
          if (sIdx === -1) break;

          let dataStart = sIdx + 6;
          if (bytes[dataStart] === 0x0d) dataStart++;
          if (bytes[dataStart] === 0x0a) dataStart++;

          const eIdx = this.findSubarray(bytes, ENDSTREAM_BYTES, dataStart);
          if (eIdx === -1) break;

          let dataEnd = eIdx;
          if (dataEnd > dataStart && bytes[dataEnd - 1] === 0x0a) dataEnd--;
          if (dataEnd > dataStart && bytes[dataEnd - 1] === 0x0d) dataEnd--;

          const streamSlice = bytes.subarray(dataStart, dataEnd);
          pos = eIdx + 9;

          const un = await this.decompressStreamBytes(streamSlice);
          if (un) {
            decompressedStreams.push(decoder.decode(un));
          } else {
            decompressedStreams.push(decoder.decode(streamSlice));
          }
        }

        const cmaps = [];
        for (const s of decompressedStreams) {
          if (s.includes("begincmap") || s.includes("beginbfchar") || s.includes("beginbfrange")) {
            cmaps.push(this.parseCMap(s));
          }
        }

        const allText = [];
        for (const s of decompressedStreams) {
          const isFontOrBinary = s.includes("hmtx") || s.includes("maxp") || s.includes("head") || s.startsWith("\x00\x01\x00\x00") || s.startsWith("OTTO");
          if (!isFontOrBinary && (s.includes("BT") || s.includes("Tj") || s.includes("TJ"))) {
            const texts = this.extractTextFromContentStream(s, cmaps);
            if (texts.length > 0) allText.push(texts.join(" "));
          }
        }

        let combinedText = allText.join("\n\n").replace(/[ \t]+/g, " ").trim();

        if (combinedText.length < 30) {
          const rawStr = decoder.decode(bytes);
          const rawTextSnippets = [];
          const tjRegex = /\(([^)]+)\)\s*Tj/g;
          let rm;
          while ((rm = tjRegex.exec(rawStr)) !== null) {
            const t = rm[1].trim();
            if (t && t.length > 1 && !t.startsWith("/")) rawTextSnippets.push(t);
          }
          if (rawTextSnippets.length > 0) {
            combinedText = rawTextSnippets.join(" ").replace(/\s+/g, " ").trim();
          }
        }

        if (combinedText.length >= 20) {
          const maxExcerpt = combinedText.length > 20000 ? combinedText.substring(0, 20000) + "\n\n...[teks dokumen dipotong untuk batas konteks]..." : combinedText;
          return `[DOKUMEN PDF: ${file.name}]\n\n${maxExcerpt}`;
        }
        return `[DOKUMEN PDF: ${file.name} (${Math.round(file.size / 1024)} KB) - Format terstruktur PDF terlampir]`;
      } catch (err) {
        return `[DOKUMEN PDF: ${file.name} - Gagal mengekstrak teks: ${err.message}]`;
      }
    },

    async parseDocxFile(file) {
      try {
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        for (let i = 0; i < bytes.length - 30; i++) {
          if (bytes[i] === 0x50 && bytes[i+1] === 0x4b && bytes[i+2] === 0x03 && bytes[i+3] === 0x04) {
            const view = new DataView(bytes.buffer, bytes.byteOffset + i);
            const compMethod = view.getUint16(8, true);
            const compSize = view.getUint32(18, true);
            const nameLen = view.getUint16(26, true);
            const extraLen = view.getUint16(28, true);
            const fileNameBytes = bytes.slice(i + 30, i + 30 + nameLen);
            const fileName = new TextDecoder().decode(fileNameBytes);
            if (fileName === "word/document.xml") {
              const dataStart = i + 30 + nameLen + extraLen;
              const compData = bytes.slice(dataStart, dataStart + compSize);
              let xmlStr = "";
              if (compMethod === 8) {
                const un = await this.decompressStreamBytes(compData);
                if (un) xmlStr = new TextDecoder().decode(un);
              } else if (compMethod === 0) {
                xmlStr = new TextDecoder().decode(compData);
              }
              const matches = xmlStr.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
              if (matches.length > 0) {
                const extracted = matches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");
                const clean = extracted.replace(/\s+/g, " ").trim();
                const maxExcerpt = clean.length > 20000 ? clean.substring(0, 20000) + "\n\n...[dipotong]..." : clean;
                return `[DOKUMEN WORD (.DOCX): ${file.name}]\n\n${maxExcerpt}`;
              }
            }
          }
        }
        const text = await this.readAsText(file);
        const xmlTextMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
        if (xmlTextMatches && xmlTextMatches.length > 0) {
          const extracted = xmlTextMatches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");
          return `[DOKUMEN WORD (.DOCX): ${file.name}]\n\n${extracted.replace(/\s+/g, " ")}`;
        }
        return `[DOKUMEN WORD (.DOCX): ${file.name} (${Math.round(file.size / 1024)} KB) terlampir]`;
      } catch (_) {
        return `[DOKUMEN WORD (.DOCX): ${file.name}]`;
      }
    },

    readAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
    },

    readAsDataURL(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }
  };

  if (typeof globalThis !== "undefined") {
    globalThis.PesatFileEngine = PesatFileEngine;
  }
})();
