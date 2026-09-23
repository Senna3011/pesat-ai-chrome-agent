// file-engine.js - File Processing Engine for Prompt Attachments
(() => {
  const PesatFileEngine = {
    async processLocalFile(file) {
      if (!file) throw new Error("File tidak ditemukan");

      const name = file.name || "file";
      const size = file.size || 0;
      const type = file.type || "";
      const ext = name.split(".").pop().toLowerCase();

      // Batas ukuran 10MB
      if (size > 10 * 1024 * 1024) {
        throw new Error(`File ${name} melebihi batas 10MB.`);
      }

      // Teks biasa / Markdown / JSON / CSV
      if (
        ["txt", "md", "csv", "json", "js", "ts", "html", "css", "py", "sql"].includes(ext) ||
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

      // Gambar (PNG, JPG, JPEG, WEBP, GIF)
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

      // PDF / Dokumen Office fallback
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
          content: `[File Lampiran Biner: ${name} (${Math.round(size / 1024)} KB)]`
        };
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
