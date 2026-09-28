// functions/api/reports.js - Cloudflare Pages Function for User Bug Reports

const MAX_REPORTS = 200;
globalThis.__PESAT_REPORTS__ = globalThis.__PESAT_REPORTS__ || [];
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

  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), MAX_REPORTS);
  const searchFilter = (url.searchParams.get("q") || "").toLowerCase();
  const categoryFilter = (url.searchParams.get("category") || "").toLowerCase();

  let reports = globalThis.__PESAT_REPORTS__ || [];

  if (categoryFilter && categoryFilter !== "all") {
    reports = reports.filter(r => (r.category || "").toLowerCase() === categoryFilter);
  }

  if (searchFilter) {
    reports = reports.filter(r => {
      const matchTitle = (r.title || "").toLowerCase().includes(searchFilter);
      const matchDesc = (r.description || "").toLowerCase().includes(searchFilter);
      const matchUser = (r.clientId || "").toLowerCase().includes(searchFilter);
      const matchUrl = (r.url || "").toLowerCase().includes(searchFilter);
      return matchTitle || matchDesc || matchUser || matchUrl;
    });
  }

  const result = reports.slice(-limit);

  return new Response(JSON.stringify({
    success: true,
    total: globalThis.__PESAT_REPORTS__.length,
    returned: result.length,
    serverTime: Date.now(),
    reports: result
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
    const now = Date.now();

    const reportEntry = {
      id: body.id || `rep_${now}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: body.timestamp || now,
      timeStr: new Date(body.timestamp || now).toISOString(),
      category: body.category || "GENERAL_BUG",
      title: String(body.title || "User Bug Report"),
      description: String(body.description || ""),
      clientId: body.clientId || "anonymous",
      url: body.url || null,
      version: body.version || "4.3.0",
      userAgent: body.userAgent || request.headers.get("User-Agent") || "Unknown",
      recentLogs: Array.isArray(body.recentLogs) ? body.recentLogs.slice(-20) : [],
      extraContext: body.extraContext || null,
      status: "OPEN"
    };

    globalThis.__PESAT_REPORTS__.push(reportEntry);
    if (globalThis.__PESAT_REPORTS__.length > MAX_REPORTS) {
      globalThis.__PESAT_REPORTS__ = globalThis.__PESAT_REPORTS__.slice(-MAX_REPORTS);
    }

    // Auto log to runtime activity as well
    globalThis.__PESAT_LOGS__.push({
      id: `log_${now}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: now,
      timeStr: new Date(now).toISOString(),
      level: "WARN",
      source: "USER_REPORT",
      type: "BUG_REPORT_RECEIVED",
      message: `[User Report: ${reportEntry.category}] ${reportEntry.description.slice(0, 100)}`,
      details: { reportId: reportEntry.id, clientId: reportEntry.clientId, url: reportEntry.url }
    });

    return new Response(JSON.stringify({
      success: true,
      reportId: reportEntry.id,
      message: "Laporan bug berhasil diterima oleh server."
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: "Invalid report payload: " + err.message
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);
  const url = new URL(request.url);
  const deleteId = url.searchParams.get("id");

  if (deleteId) {
    globalThis.__PESAT_REPORTS__ = globalThis.__PESAT_REPORTS__.filter(r => r.id !== deleteId);
    return new Response(JSON.stringify({
      success: true,
      message: `Laporan ${deleteId} berhasil dihapus.`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  globalThis.__PESAT_REPORTS__ = [];
  return new Response(JSON.stringify({
    success: true,
    message: "Semua laporan bug berhasil dibersihkan."
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
