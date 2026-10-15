// agent-engine.js - Typed, dependency-free core for planning, tool safety, receipts, and verification
(() => {
  const SCHEMA_VERSION = 1;
  const MODES = new Set(["answer", "research", "execute", "hybrid"]);
  const TASK_STATUSES = new Set(["CLASSIFY", "PLAN", "OBSERVE", "RETRIEVE", "ACT", "VERIFY", "RECOVER", "FINALIZE", "DONE", "FAILED", "CANCELLED", "WAITING_USER", "EXECUTING", "PLANNING"]);
  const STEP_KINDS = new Set(["retrieve", "observe", "analyze", "act", "verify", "compose"]);
  const STEP_STATUSES = new Set(["pending", "in_progress", "done", "failed", "skipped"]);
  const SIDE_EFFECTS = new Set(["none", "local", "external"]);
  const RISKS = new Set(["low", "medium", "high"]);
  const ERROR_TYPES = new Set([
    "TARGET_NOT_FOUND", "PAGE_CHANGED", "AUTH_REQUIRED", "PERMISSION_DENIED",
    "RATE_LIMITED", "NETWORK_ERROR", "INVALID_INPUT", "VERIFICATION_FAILED",
    "USER_PRESENCE_REQUIRED", "UNSUPPORTED", "TIMEOUT", "PARSE_ERROR", "EXECUTION_FAILED"
  ]);

  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const nowIso = () => new Date().toISOString();
  const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  function classifyTask(goal = "", contextRefs = []) {
    const text = String(goal).trim();
    const mutating = /(?:\b(?:kirim|send|publish|post|hapus|delete|checkout|bayar|transfer|beli|submit|ubah|update|append|login)\b|\btulis\s+ke\b|\bisi\s+form\b)/i.test(text);
    const browserAction = /\b(buka|open|kunjungi|akses|klik|click|ketik|isi|pilih|scroll|navigate|unduh|download)\b/i.test(text) || mutating;
    const research = /\b(riset|research|bandingkan|compare|sumber|referensi|knowledge|dokumen tersimpan|multi[- ]?site)\b/i.test(text);
    const analysis = /\b(rangkum|ringkas|analisis|audit|jelaskan|apa|mengapa|bagaimana|rekomendasi)\b/i.test(text) || text.includes("?");
    const ambiguity = text.length < 3 || /\b(itu|ini|yang tadi)\b/i.test(text) && !contextRefs.length;
    let mode = "answer";
    if (browserAction && (analysis || research)) mode = "hybrid";
    else if (browserAction) mode = "execute";
    else if (research) mode = "research";
    return {
      mode,
      capabilities: [
        ...(browserAction ? ["browser"] : []),
        ...(research ? ["knowledge"] : []),
        ...(analysis ? ["analysis"] : [])
      ],
      risk: mutating ? "high" : (browserAction ? "medium" : "low"),
      ambiguity,
      confidence: text ? (ambiguity ? 0.55 : 0.9) : 0
    };
  }

  function isSimpleDirectTask(goal = "") {
    const text = String(goal).trim();
    if (/^(?:tolong\s+|mohon\s+)?(?:buka|open|kunjungi|akses|go\s*to)\s+(?:website\s+|situs\s+|url\s+)?(?:https?:\/\/)?[^\s]+\.[a-z]{2,}(?:\/[^\s]*)?\s*$/i.test(text)) return true;
    if (/^(?:tolong\s+|mohon\s+)?(?:klik|click|tekan|pilih)\s+[^,;]+$/i.test(text)) return true;
    const classified = classifyTask(text);
    return classified.mode === "answer" && !classified.ambiguity;
  }

  function shouldUsePlanner(goal = "", contextRefs = []) {
    const classified = classifyTask(goal, contextRefs);
    if (isSimpleDirectTask(goal)) return false;
    return classified.mode === "research" || classified.mode === "hybrid" ||
      /\b(lalu|kemudian|setelah itu|dan kemudian|multi[- ]?site|beberapa|semua tab|laporan|workflow)\b/i.test(String(goal));
  }

  function createTaskSpec({ id, goal, mode, capabilities, risk, contextRefs = [], status = "CLASSIFY", budget = {}, createdAt } = {}) {
    const classified = classifyTask(goal, contextRefs);
    const task = {
      id: id || makeId("task"),
      goal: String(goal || "").trim(),
      mode: mode || classified.mode,
      capabilities: Array.isArray(capabilities) ? [...new Set(capabilities.map(String))] : classified.capabilities,
      risk: risk || classified.risk,
      contextRefs: Array.isArray(contextRefs) ? contextRefs.map((ref) => typeof ref === "string" ? ref : String(ref?.sourceId || ref?.id || "")).filter(Boolean) : [],
      status,
      budget: {
        maxSteps: Math.max(1, Number(budget.maxSteps) || 30),
        maxRetriesPerStep: Math.max(0, Number(budget.maxRetriesPerStep) || 3),
        maxReplans: Math.max(0, Number(budget.maxReplans) || 2)
      },
      createdAt: createdAt || nowIso(),
      schemaVersion: SCHEMA_VERSION
    };
    const errors = [];
    if (!task.goal) errors.push("goal wajib diisi");
    if (!MODES.has(task.mode)) errors.push(`mode tidak valid: ${task.mode}`);
    if (!RISKS.has(task.risk)) errors.push(`risk tidak valid: ${task.risk}`);
    if (!TASK_STATUSES.has(task.status)) errors.push(`status tidak valid: ${task.status}`);
    if (errors.length) throw Object.assign(new Error(errors.join("; ")), { code: "INVALID_INPUT", errors });
    return task;
  }

  function normalizePlanStep(step, index = 0) {
    const raw = typeof step === "string" ? { objective: step } : (step || {});
    return {
      id: String(raw.id ?? `step-${index + 1}`),
      objective: String(raw.objective || raw.description || "").trim().slice(0, 500),
      kind: raw.kind || (raw.tool ? "act" : "analyze"),
      dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.map(String) : [],
      tool: raw.tool ? String(raw.tool) : null,
      inputs: isObject(raw.inputs) ? raw.inputs : {},
      successCriteria: Array.isArray(raw.successCriteria) ? raw.successCriteria.slice(0, 10) : [],
      sideEffect: raw.sideEffect || "none",
      risk: raw.risk || "low",
      maxAttempts: Math.min(5, Math.max(1, Number(raw.maxAttempts) || 2)),
      status: raw.status || "pending",
      description: String(raw.objective || raw.description || "").trim().slice(0, 500)
    };
  }

  function validatePlan(plan, { availableTools = [], maxSteps = 10, taskRisk = "high" } = {}) {
    const rawSteps = Array.isArray(plan) ? plan : plan?.plan;
    const errors = [];
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) return { valid: false, errors: ["plan harus berisi minimal satu langkah"], plan: [] };
    if (rawSteps.length > maxSteps) errors.push(`plan melebihi batas ${maxSteps} langkah`);
    const steps = rawSteps.slice(0, maxSteps).map(normalizePlanStep);
    const ids = new Set();
    const toolNames = new Set(availableTools.map((tool) => typeof tool === "string" ? tool : tool?.function?.name || tool?.name).filter(Boolean));
    const riskRank = { low: 0, medium: 1, high: 2 };

    for (const step of steps) {
      if (!step.id || ids.has(step.id)) errors.push(`id langkah duplikat/tidak valid: ${step.id}`);
      ids.add(step.id);
      if (!step.objective) errors.push(`objective kosong pada ${step.id}`);
      if (!STEP_KINDS.has(step.kind)) errors.push(`kind tidak valid pada ${step.id}`);
      if (!SIDE_EFFECTS.has(step.sideEffect)) errors.push(`sideEffect tidak valid pada ${step.id}`);
      if (!RISKS.has(step.risk)) errors.push(`risk tidak valid pada ${step.id}`);
      if (!STEP_STATUSES.has(step.status)) errors.push(`status tidak valid pada ${step.id}`);
      if (step.kind === "act" && !step.tool) errors.push(`tool wajib untuk langkah act ${step.id}`);
      if (step.tool && !toolNames.has(step.tool)) errors.push(`tool tidak tersedia: ${step.tool}`);
      if ((riskRank[step.risk] ?? 99) > (riskRank[taskRisk] ?? 0)) errors.push(`risk langkah ${step.id} melebihi risk task`);
      if ((step.kind === "act" || step.kind === "verify") && step.successCriteria.length === 0) errors.push(`successCriteria wajib pada ${step.id}`);
    }

    const byId = new Map(steps.map((step, index) => [step.id, index]));
    for (const [index, step] of steps.entries()) {
      for (const dependency of step.dependencies) {
        if (!byId.has(dependency)) errors.push(`dependency tidak ditemukan pada ${step.id}: ${dependency}`);
        else if (byId.get(dependency) >= index) errors.push(`dependency harus mendahului ${step.id}: ${dependency}`);
      }
    }
    return { valid: errors.length === 0, errors, plan: steps };
  }

  function parseStrictJSON(raw, label = "response") {
    if (isObject(raw) || Array.isArray(raw)) return raw;
    if (typeof raw !== "string") throw Object.assign(new Error(`${label} bukan JSON`), { code: "PARSE_ERROR" });
    let text = raw.trim();
    const fenced = text.match(/^```json\s*([\s\S]*?)\s*```$/i);
    if (fenced) text = fenced[1].trim();
    if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
      throw Object.assign(new Error(`${label} tidak berisi JSON murni`), { code: "PARSE_ERROR" });
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      throw Object.assign(new Error(`${label} JSON tidak valid: ${error.message}`), { code: "PARSE_ERROR" });
    }
  }

  function validateSchema(value, schema = {}, path = "$") {
    const errors = [];
    if (!schema || Object.keys(schema).length === 0) return errors;
    if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) errors.push(`${path} harus salah satu dari enum`);
    const type = Array.isArray(value) ? "array" : value === null ? "null" : (Number.isInteger(value) ? "integer" : typeof value);
    const accepted = Array.isArray(schema.type) ? schema.type : (schema.type ? [schema.type] : []);
    if (accepted.length && !accepted.includes(type) && !(type === "integer" && accepted.includes("number"))) {
      errors.push(`${path} harus bertipe ${accepted.join("|")}`);
      return errors;
    }
    if (typeof value === "string") {
      if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} terlalu pendek`);
      if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} terlalu panjang`);
      if (schema.pattern) {
        try { if (!new RegExp(schema.pattern).test(value)) errors.push(`${path} tidak sesuai pattern`); }
        catch (_) { errors.push(`${path} memiliki schema pattern tidak valid`); }
      }
    }
    if (typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} di bawah minimum`);
      if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} di atas maximum`);
    }
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} kekurangan item`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} kelebihan item`);
      value.forEach((item, index) => errors.push(...validateSchema(item, schema.items || {}, `${path}[${index}]`)));
    }
    if (isObject(value)) {
      const properties = schema.properties || {};
      for (const required of schema.required || []) if (!hasOwn(value, required)) errors.push(`${path}.${required} wajib diisi`);
      for (const [key, item] of Object.entries(value)) {
        if (properties[key]) errors.push(...validateSchema(item, properties[key], `${path}.${key}`));
        else if (schema.additionalProperties === false) errors.push(`${path}.${key} tidak diizinkan`);
      }
    }
    return errors;
  }

  function validateToolArguments(args, schema) {
    const errors = validateSchema(args, schema || { type: "object" });
    return { valid: errors.length === 0, errors, value: errors.length ? null : args };
  }

  function redact(value, redactFields = []) {
    const sensitive = new Set(["password", "passwd", "token", "authorization", "apiKey", "secret", "cookie", ...redactFields].map((key) => String(key).toLowerCase()));
    const walk = (item) => {
      if (Array.isArray(item)) return item.map(walk);
      if (!isObject(item)) return item;
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, sensitive.has(key.toLowerCase()) ? "[REDACTED]" : walk(child)]));
    };
    return walk(value);
  }

  function createActionReceipt({ id, stepId, tool, validatedInput = {}, startedAt, finishedAt, success = false, errorType = null, observationRef = null, beforeState = null, afterState = null, verification = [] } = {}) {
    const normalizedError = errorType && ERROR_TYPES.has(errorType) ? errorType : (errorType ? "EXECUTION_FAILED" : null);
    return {
      id: id || makeId("receipt"),
      stepId: String(stepId || ""),
      tool: String(tool || "unknown"),
      validatedInput,
      startedAt: startedAt || nowIso(),
      finishedAt: finishedAt || nowIso(),
      success: Boolean(success),
      errorType: normalizedError,
      observationRef,
      beforeState,
      afterState,
      verification: Array.isArray(verification) ? verification : [],
      schemaVersion: SCHEMA_VERSION
    };
  }

  function verifyDeterministically({ action = {}, result = {}, beforeState = {}, afterState = {}, successCriteria = [] } = {}) {
    const checks = [];
    if (!result || result.success !== true) {
      checks.push({ type: "execution", passed: false, detail: result?.message || result?.error || "Eksekusi gagal" });
      return { status: "failed", passed: false, conclusive: true, checks, errorType: result?.errorType || "EXECUTION_FAILED" };
    }
    const actionType = action.actionType || action.action || action.type || "";
    if (["navigate", "navigate_to"].includes(actionType)) {
      const expected = String(action.url || action.value || "");
      const actual = String(afterState.url || result.url || result.raw?.url || "");
      let passed = Boolean(actual && actual !== String(beforeState.url || ""));
      if (expected && actual) {
        try { passed = new URL(actual).hostname === new URL(expected).hostname; }
        catch (_) { passed = actual.startsWith(expected); }
      }
      checks.push({ type: "url", passed, expected, actual });
    }
    if (["type", "type_text", "fill"].includes(actionType) && hasOwn(result, "valueReadBack")) {
      const expected = String(action.text ?? action.value ?? "");
      const actual = String(result.valueReadBack ?? "");
      checks.push({ type: "value", passed: actual === expected, expectedLength: expected.length, actualLength: actual.length });
    }
    if (actionType === "click" || actionType === "click_element") {
      const changed = result.stateChanged === true || (beforeState.url && afterState.url && beforeState.url !== afterState.url);
      if (changed) checks.push({ type: "state-change", passed: true });
    }
    if (Number.isFinite(result.rows?.length)) checks.push({ type: "row-count", passed: result.rows.length > 0, actual: result.rows.length });
    if (result.checksum) checks.push({ type: "checksum", passed: typeof result.checksum === "string" && result.checksum.length > 0 });

    for (const criterion of successCriteria) {
      if (!isObject(criterion)) continue;
      if (criterion.type === "url_matches") {
        let passed = false;
        try { passed = new RegExp(criterion.pattern).test(String(afterState.url || "")); } catch (_) {}
        checks.push({ type: criterion.type, passed, pattern: criterion.pattern });
      } else if (criterion.type === "min_rows") {
        checks.push({ type: criterion.type, passed: Number(result.rows?.length || 0) >= Number(criterion.value || 1) });
      } else if (criterion.type === "result_field_equals") {
        checks.push({ type: criterion.type, passed: result[criterion.field] === criterion.value, field: criterion.field });
      }
    }
    if (!checks.length) return { status: "inconclusive", passed: false, conclusive: false, checks: [] };
    const passed = checks.every((check) => check.passed);
    return { status: passed ? "passed" : "failed", passed, conclusive: true, checks, errorType: passed ? null : "VERIFICATION_FAILED" };
  }

  const AgentEngine = {
    SCHEMA_VERSION,
    ERROR_TYPES: [...ERROR_TYPES],
    classifyTask,
    isSimpleDirectTask,
    shouldUsePlanner,
    createTaskSpec,
    normalizePlanStep,
    validatePlan,
    parseStrictJSON,
    validateSchema,
    validateToolArguments,
    redact,
    createActionReceipt,
    verifyDeterministically
  };

  if (typeof globalThis !== "undefined") globalThis.PesatAgentEngine = AgentEngine;
  if (typeof module !== "undefined" && module.exports) module.exports = AgentEngine;
})();
