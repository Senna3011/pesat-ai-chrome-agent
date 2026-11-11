import { HttpError } from "./helpers.mjs";

function verifyAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!env.ADMIN_API_KEY || token !== env.ADMIN_API_KEY) {
    throw new HttpError(401, "UNAUTHORIZED: Admin token required");
  }
}

export async function handleTelemetryLogs(request, env) {
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body) throw new HttpError(400, "INVALID_JSON");
    const items = Array.isArray(body) ? body : [body];

    if (env.DB) {
      try {
        const stmt = env.DB.prepare(
          "INSERT INTO audit_events (id, tenant_id, action, resource_type, resource_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        const batch = items.slice(0, 50).map((item) => {
          const id = item.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const tenantId = item.tenantId || "default";
          const action = String(item.type || item.level || "EVENT").toUpperCase();
          const resourceType = "extension_telemetry";
          const resourceId = item.clientId || null;
          const detailsJson = JSON.stringify(item);
          const createdAt = new Date(item.timestamp || Date.now()).toISOString();
          return stmt.bind(id, tenantId, action, resourceType, resourceId, detailsJson, createdAt);
        });
        await env.DB.batch(batch);
      } catch (err) {
        console.warn("[Telemetry] DB insert failed:", err.message);
      }
    }
    return { success: true, count: items.length };
  }

  if (request.method === "GET") {
    verifyAdmin(request, env);
    if (!env.DB) return { success: true, logs: [] };
    const rows = await env.DB.prepare(
      "SELECT id, tenant_id, action, resource_type, resource_id, details_json, created_at FROM audit_events WHERE resource_type = 'extension_telemetry' ORDER BY created_at DESC LIMIT 100"
    ).all();
    const logs = (rows.results || []).map((r) => {
      let details = {};
      try { details = JSON.parse(r.details_json); } catch (_) {}
      return { id: r.id, action: r.action, createdAt: r.created_at, ...details };
    });
    return { success: true, logs };
  }

  if (request.method === "DELETE") {
    verifyAdmin(request, env);
    if (env.DB) {
      await env.DB.prepare("DELETE FROM audit_events WHERE resource_type = 'extension_telemetry'").run();
    }
    return { success: true, message: "Logs cleared" };
  }

  throw new HttpError(405, "METHOD_NOT_ALLOWED");
}

export async function handleTelemetryReports(request, env) {
  if (request.method === "POST") {
    const report = await request.json().catch(() => null);
    if (!report) throw new HttpError(400, "INVALID_JSON");
    const id = report.id || `report_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    if (env.DB) {
      try {
        const stmt = env.DB.prepare(
          "INSERT INTO audit_events (id, tenant_id, action, resource_type, resource_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        const tenantId = report.tenantId || "default";
        const action = "USER_BUG_REPORT";
        const resourceType = "bug_report";
        const resourceId = report.clientId || null;
        const detailsJson = JSON.stringify(report);
        const createdAt = new Date(report.timestamp || Date.now()).toISOString();
        await stmt.bind(id, tenantId, action, resourceType, resourceId, detailsJson, createdAt).run();
      } catch (err) {
        console.warn("[Telemetry Reports] DB insert failed:", err.message);
      }
    }
    return { success: true, id };
  }

  if (request.method === "GET") {
    verifyAdmin(request, env);
    if (!env.DB) return { success: true, reports: [] };
    const rows = await env.DB.prepare(
      "SELECT id, tenant_id, action, resource_type, resource_id, details_json, created_at FROM audit_events WHERE resource_type = 'bug_report' ORDER BY created_at DESC LIMIT 100"
    ).all();
    const reports = (rows.results || []).map((r) => {
      let details = {};
      try { details = JSON.parse(r.details_json); } catch (_) {}
      return { id: r.id, createdAt: r.created_at, ...details };
    });
    return { success: true, reports };
  }

  if (request.method === "DELETE") {
    verifyAdmin(request, env);
    if (env.DB) {
      await env.DB.prepare("DELETE FROM audit_events WHERE resource_type = 'bug_report'").run();
    }
    return { success: true, message: "Reports cleared" };
  }

  throw new HttpError(405, "METHOD_NOT_ALLOWED");
}
