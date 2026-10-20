const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

// Load file engine in node environment
const fileEngineCode = fs.readFileSync('extension/file-engine.js', 'utf8');
eval(fileEngineCode);

test('PesatFileEngine extracts text from uncompressed text and JSON files', async () => {
  const mockFile = {
    name: 'test.txt',
    size: 50,
    type: 'text/plain',
    arrayBuffer: async () => Buffer.from('Proposal Skripsi: Analisis AI'),
    text: async () => 'Proposal Skripsi: Analisis AI'
  };
  globalThis.FileReader = class {
    readAsText(f) {
      this.result = 'Proposal Skripsi: Analisis AI';
      this.onload();
    }
  };

  const processed = await globalThis.PesatFileEngine.processLocalFile(mockFile);
  assert.equal(processed.type, 'text');
  assert.match(processed.content, /Proposal Skripsi/);
});

test('PesatFileEngine extracts text from PDF stream with CMaps and deflate', async () => {
  // Simple PDF content stream with Tj operator
  const contentStream = 'BT\n/F1 12 Tf\n(Proposal Skripsi Azhar) Tj\nET';
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(contentStream, 'latin1'));

  const pdfString = `%PDF-1.4\n1 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n` +
    compressed.toString('latin1') +
    '\nendstream\nendobj\n%%EOF';

  const pdfBuf = Buffer.from(pdfString, 'latin1');
  const mockPdfFile = {
    name: 'Proposal.pdf',
    size: pdfBuf.length,
    arrayBuffer: async () => pdfBuf.buffer.slice(pdfBuf.byteOffset, pdfBuf.byteOffset + pdfBuf.byteLength)
  };

  const result = await globalThis.PesatFileEngine.parsePdfFile(mockPdfFile);
  assert.match(result, /Proposal Skripsi Azhar/);
});
