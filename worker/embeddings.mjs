import { HttpError } from "./helpers.mjs";

function validateVectors(vectors, expected) {
  if (!Array.isArray(vectors) || vectors.length !== expected) throw new HttpError(502, "INVALID_EMBEDDING_RESPONSE");
  for (const vector of vectors) {
    if (!Array.isArray(vector) || !vector.length || vector.some((value) => !Number.isFinite(value))) throw new HttpError(502, "INVALID_EMBEDDING_RESPONSE");
  }
  return vectors;
}

export async function embedTexts(texts, env) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const model = env.EMBEDDING_MODEL || "@cf/baai/bge-m3";
  if (env.AI) {
    const result = await env.AI.run(model, { text: texts });
    const vectors = result?.data || result?.result?.data;
    return validateVectors(vectors, texts.length);
  }
  if (env.EMBEDDING_BASE_URL && env.EMBEDDING_API_KEY) {
    const response = await fetch(env.EMBEDDING_BASE_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.EMBEDDING_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model, input: texts })
    });
    if (!response.ok) throw new HttpError(502, "EMBEDDING_PROVIDER_ERROR");
    const result = await response.json();
    return validateVectors(result?.data?.map((item) => item.embedding), texts.length);
  }
  throw new HttpError(503, "EMBEDDING_NOT_CONFIGURED");
}
