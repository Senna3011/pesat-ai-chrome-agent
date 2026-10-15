import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const errors = [];
const databaseId = config.d1_databases?.find((item) => item.binding === "DB")?.database_id || "";
if (!databaseId || databaseId.includes("REPLACE_WITH")) errors.push("Set d1_databases[DB].database_id to the real Cloudflare D1 database ID.");
if (!config.vars?.ALLOWED_EXTENSION_ID && !config.vars?.ALLOWED_ORIGINS) errors.push("Set vars.ALLOWED_EXTENSION_ID or exact vars.ALLOWED_ORIGINS.");
if (!config.vars?.GOOGLE_OAUTH_CLIENT_IDS && !config.vars?.GOOGLE_OAUTH_CLIENT_ID) errors.push("Set vars.GOOGLE_OAUTH_CLIENT_IDS to the approved Chrome OAuth client ID allowlist.");
if (!config.vectorize?.some((item) => item.binding === "VECTORIZE")) errors.push("Configure the VECTORIZE binding.");
if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Deployment configuration is complete.");
