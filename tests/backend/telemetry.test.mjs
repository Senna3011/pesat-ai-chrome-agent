import test from "node:test";
import assert from "node:assert/strict";
import { handleTelemetryLogs, handleTelemetryReports } from "../../worker/telemetry.mjs";

test("handleTelemetryLogs accepts batch logs and handles DB insertion safely", async () => {
  const inserted = [];
  const fakeDb = {
    prepare(query) {
      return {
        bind(...args) {
          return { query, args };
        }
      };
    },
    async batch(statements) {
      inserted.push(...statements);
      return [];
    }
  };

  const req = new Request("https://api.pesat.ai/api/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      { id: "log_1", level: "INFO", message: "Test log 1", timestamp: 123456789 },
      { id: "log_2", level: "ERROR", message: "Test error 2", timestamp: 123456790 }
    ])
  });

  const res = await handleTelemetryLogs(req, { DB: fakeDb });
  assert.equal(res.success, true);
  assert.equal(res.count, 2);
  assert.equal(inserted.length, 2);
  assert.equal(inserted[0].args[0], "log_1");
  assert.equal(inserted[1].args[0], "log_2");
});

test("handleTelemetryLogs gracefully succeeds even when DB binding is absent", async () => {
  const req = new Request("https://api.pesat.ai/api/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ id: "log_none", level: "WARN", message: "No db" }])
  });

  const res = await handleTelemetryLogs(req, {});
  assert.equal(res.success, true);
  assert.equal(res.count, 1);
});

test("handleTelemetryReports accepts bug report and saves to DB", async () => {
  let executed = null;
  const fakeDb = {
    prepare(query) {
      return {
        bind(...args) {
          return {
            async run() {
              executed = { query, args };
              return { success: true };
            }
          };
        }
      };
    }
  };

  const report = {
    id: "rep_123",
    clientId: "usr_abc",
    message: "Bug in Google Docs",
    details: { url: "https://docs.google.com/document/d/1" }
  };

  const req = new Request("https://api.pesat.ai/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report)
  });

  const res = await handleTelemetryReports(req, { DB: fakeDb });
  assert.equal(res.success, true);
  assert.equal(res.id, "rep_123");
  assert.ok(executed);
  assert.equal(executed.args[0], "rep_123");
  assert.equal(executed.args[2], "USER_BUG_REPORT");
});

test("handleTelemetryLogs GET requires admin token", async () => {
  const unauthReq = new Request("https://api.pesat.ai/api/logs", {
    method: "GET"
  });
  await assert.rejects(
    async () => handleTelemetryLogs(unauthReq, { ADMIN_API_KEY: "secret123" }),
    /UNAUTHORIZED/
  );
});
