// Retries are opt-in: only callers making read-only source queries enable them.
export class SourceError extends Error {
  constructor(kind, message, { status, retryAfterMs = 0 } = {}) {
    super(message);
    this.name = "SourceError";
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export async function requestJSON(url, options = {}, {
  retries = 0, timeoutMs = 40000, retryDelayMs = 1200,
  onRetry = () => {}, fetchImpl = fetch,
} = {}) {
  const { signal } = options;
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    const ac = new AbortController();
    const abort = () => ac.abort(signal.reason);
    signal?.addEventListener("abort", abort, { once: true });
    let timedOut = false, failure;
    const timer = setTimeout(() => { timedOut = true; ac.abort(); }, timeoutMs);
    try {
      const res = await fetchImpl(url, { ...options, signal: ac.signal });
      if (!res.ok) {
        const header = res.headers.get("Retry-After");
        const delay = header == null ? 0 : /^\d+$/.test(header)
          ? Number(header) * 1000 : Date.parse(header) - Date.now();
        throw new SourceError("http", `Source returned HTTP ${res.status}.`, {
          status: res.status, retryAfterMs: Number.isFinite(delay) ? Math.max(0, delay) : 0,
        });
      }
      const data = await res.json();
      signal?.throwIfAborted();
      return data;
    } catch (err) {
      signal?.throwIfAborted();
      failure = timedOut
        ? new SourceError("timeout", "The source did not respond within 40 seconds.")
        : err instanceof TypeError
          ? new SourceError("network", "The browser could not connect to the source.")
          : err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
    const transient = ["timeout", "network"].includes(failure.kind) ||
      failure.kind === "http" && [408, 429, 500, 502, 503, 504].includes(failure.status);
    if (!transient || attempt >= retries || failure.retryAfterMs > 30000) throw failure;
    onRetry(failure);
    await pause(Math.max(retryDelayMs, failure.retryAfterMs || 0), signal);
  }
}

export function sourceFailureMessage(error) {
  if (error.kind === "timeout") return "USAspending took too long to respond. Retry this search; no conclusion about matching suppliers can be drawn.";
  if (error.kind === "network") return "The browser could not reach USAspending. Check your connection and retry; matching suppliers have not been ruled out.";
  if (error.kind === "http") return `USAspending returned HTTP ${error.status}. ${error.status === 429 ? "The source is limiting requests. Wait before retrying." : error.status >= 500 ? "The source is temporarily unavailable. Retry this search." : "The source did not accept this request. Check the search criteria before retrying."} This is not a completed search with zero matches.`;
  return "The USAspending response could not be read. Retry this search; matching suppliers have not been ruled out.";
}
