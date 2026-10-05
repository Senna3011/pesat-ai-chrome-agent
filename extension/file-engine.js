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

    async parsePdfFile(file) {
      try {
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        const decoder = new TextDecoder("latin1");
        const rawStr = decoder.decode(bytes);
        const textSnippets = [];

        const tjRegex = /\(([^)]+)\)\s*Tj/g;
        let match;
        while ((match = tjRegex.exec(rawStr)) !== null) {
          const t = match[1].trim();
          if (t && t.length > 1 && !t.startsWith("/")) textSnippets.push(t);
        }

        const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
        while ((match = arrayTjRegex.exec(rawStr)) !== null) {
          const subMatches = match[1].match(/\(([^)]+)\)/g);
          if (subMatches) {
            const combined = subMatches.map(s => s.slice(1, -1)).join("");
            if (combined.trim()) textSnippets.push(combined.trim());
          }
        }

        const combinedText = textSnippets.join(" ").replace(/\s+/g, " ").trim();
        if (combinedText.length >= 20) {
          return `[DOKUMEN PDF: ${file.name}]\n\n${combinedText}`;
        }
        return `[DOKUMEN PDF: ${file.name} (${Math.round(file.size / 1024)} KB) - Format terstruktur PDF terlampir]`;
      } catch (err) {
        return `[DOKUMEN PDF: ${file.name} - Gagal mengekstrak teks: ${err.message}]`;
      }
    },

    async parseDocxFile(file) {
      try {
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
