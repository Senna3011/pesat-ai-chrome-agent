const test = require('node:test');
const assert = require('node:assert/strict');

function shouldSendImmediately(text = "") {
  const isExplicitDraft = /(?:draf|draft|simpan\s+(?:di|ke)\s+draf|tulis\s+saja|hanya\s+buat|tuliskan\s+draf|buatkan\s+draf|tulis\s+draf|buat\s+draf|jangan\s+kirim)/i.test(text);
  if (isExplicitDraft) return false;
  return /(?:kirim|kirimkan|send|submit|langsung|sekarang|auto\s*send)/i.test(text);
}

test('email sendNow detection: triggers immediate send for direct send commands', () => {
  assert.equal(shouldSendImmediately('tolong kirim email ke test@example.com'), true);
  assert.equal(shouldSendImmediately('kirimkan email ke penerima@domain.com subjek halo'), true);
  assert.equal(shouldSendImmediately('send email to someone@test.com with message hi'), true);
  assert.equal(shouldSendImmediately('kirim sekarang ke a@b.com'), true);
});

test('email sendNow detection: keeps draft mode for explicit draft requests', () => {
  assert.equal(shouldSendImmediately('buat draf email ke boss@company.com'), false);
  assert.equal(shouldSendImmediately('tulis draf email untuk klien'), false);
  assert.equal(shouldSendImmediately('tolong simpan di draf dulu jangan kirim'), false);
  assert.equal(shouldSendImmediately('tulis saja emailnya jangan kirim'), false);
  assert.equal(shouldSendImmediately('buatkan draf email penawaran kerja'), false);
});
