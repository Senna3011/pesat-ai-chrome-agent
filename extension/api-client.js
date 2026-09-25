// api-client.js - Resilient Network Fetcher with Exponential Backoff & Circuit Timeout
(() => {
  /**
   * Resilient Fetch with Exponential Backoff and Timeout
   * @param {string} url - API Endpoint URL
   * @param {RequestInit & { timeout?: number }} options - Fetch Options
   * @param {number} retries - Maximum retry attempts (default 3)
   * @param {number} backoff - Initial backoff delay in ms (default 800)
   * @returns {Promise<any>}
   */
  async function apiFetchWithRetry(url, options = {}, retries = 3, backoff = 800) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      let timeoutId = null;
      try {
        const controller = new AbortController();
        const timeoutMs = options.timeout || 35000;
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const fetchOptions = {
          ...options,
          signal: controller.signal
        };

        const response = await fetch(url, fetchOptions);
        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          // Retry on Rate Limit (429) or Server Errors (5xx)
          if (response.status === 429 || response.status >= 500) {
            const errBody = await response.text().catch(() => "");
            throw new Error(`HTTP_${response.status}: ${errBody || response.statusText}`);
          }
          const errBody = await response.text().catch(() => "");
          throw new Error(`API_ERROR: ${response.status} - ${errBody || response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          return await response.json();
        }
        return await response.text();
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);

        const isLastAttempt = attempt === retries;
        const isAbort = err.name === "AbortError";
        const isNetworkErr = isAbort || err.message?.includes("Failed to fetch") || err.message?.includes("HTTP_");

        if (isLastAttempt || (!isNetworkErr && !err.message?.includes("HTTP_429"))) {
          throw err;
        }

        // Jittered exponential backoff
        const delay = backoff * Math.pow(2, attempt - 1) + Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  const ApiClient = {
    fetchWithRetry: apiFetchWithRetry
  };

  if (typeof globalThis !== "undefined") {
    globalThis.apiFetchWithRetry = apiFetchWithRetry;
    globalThis.PesatApiClient = ApiClient;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { apiFetchWithRetry, ApiClient };
  }
})();
