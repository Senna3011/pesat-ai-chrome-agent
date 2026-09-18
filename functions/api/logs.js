// functions/api/logs.js - Cloudflare Pages Function for Realtime Activity & Error Logging

const MAX_LOGS = 500;
globalThis.__PESAT_LOGS__ = globalThis.__PESAT_LOGS__ || [];

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff"
  };
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, context.env)
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);
  const url = new URL(request.url);

  const since = parseInt(url.searchParams.get("since") || "0", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), MAX_LOGS);
  const levelFilter = (url.searchParams.get("level") || "").toUpperCase();
  const searchFilter = (url.searchParams.get("q") || "").toLowerCase();

  let logs = globalThis.__PESAT_LOGS__ || [];

  if (since > 0) {
    logs = logs.filter(l => l.timestamp > since);
  }

  if (levelFilter && levelFilter !== "ALL") {
    logs = logs.filter(l => l.level === levelFilter);
  }

  if (searchFilter) {
    logs = logs.filter(l => {
      const matchMsg = (l.message || "").toLowerCase().includes(searchFilter);
      const matchType = (l.type || "").toLowerCase().includes(searchFilter);
      const matchSrc = (l.source || "").toLowerCase().includes(searchFilter);
      const matchDet = l.details ? JSON.stringify(l.details).toLowerCase().includes(searchFilter) : false;
      return matchMsg || matchType || matchSrc || matchDet;
    });
  }

  const result = logs.slice(-limit);

  return new Response(JSON.stringify({
    success: true,
    total: globalThis.__PESAT_LOGS__.length,
    returned: result.length,
    serverTime: Date.now(),
    logs: result
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];
    const now = Date.now();

    for (const item of items) {
      if (!item) continue;
      const logEntry = {
        id: item.id || `log_${now}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: item.timestamp || now,
        timeStr: new Date(item.timestamp || now).toISOString(),
        level: (item.level || "INFO").toUpperCase(),
        source: item.source || "UNKNOWN",
        type: item.type || "GENERIC",
        message: String(item.message || ""),
        details: item.details || null,
        tabId: item.tabId || null,
        sessionId: item.sessionId || null,
        url: item.url || null
      };

      globalThis.__PESAT_LOGS__.push(logEntry);
    }

    if (globalThis.__PESAT_LOGS__.length > MAX_LOGS) {
      globalThis.__PESAT_LOGS__ = globalThis.__PESAT_LOGS__.slice(-MAX_LOGS);
    }

    return new Response(JSON.stringify({
      success: true,
      added: items.length,
      currentTotal: globalThis.__PESAT_LOGS__.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: "Invalid log payload: " + err.message
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);
  globalThis.__PESAT_LOGS__ = [];

  return new Response(JSON.stringify({
    success: true,
    message: "Semua log aktivitas berhasil dibersihkan."
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
