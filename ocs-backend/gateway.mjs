import { samQuery, samURL, publicSamPage } from "../scripts/ocs-sam-core.mjs";
import {
  exclusionQuery,
  exclusionURL,
  publicExclusionPage,
} from "../scripts/ocs-sam-exclusions.mjs";
export class PublicError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export async function boundedJSON(body, limit) {
  let length = 0;
  const chunks = [];
  if (!body) throw new PublicError("Missing request or response body.");
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new PublicError("Request or response is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new PublicError("Unreadable JSON response or request.");
  }
}
export function resetTime(time) {
  const d = new Date(time);
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

// One persistent coordinator per SAM credential; all callers share its quota.
// Store operations are synchronous SQL, with no await between quota read/write.
export class SharedSamGateway {
  constructor({
    store,
    key,
    countries,
    budget = 10,
    seedDay = "",
    seedUsed = 0,
    fetchImpl = (...args) => fetch(...args),
    now = () => Date.now(),
  }) {
    Object.assign(this, {
      store,
      key,
      countries,
      budget,
      seedDay,
      seedUsed,
      fetchImpl,
      now,
    });
    if (!Number.isInteger(budget) || budget < 1 || budget > 1000)
      throw new Error("Invalid service budget");
  }
  state() {
    const day = new Date(this.now()).toISOString().slice(0, 10),
      old = this.store.get("quota");
    if (old && old.day === day) return old;
    return {
      day,
      used: day === this.seedDay ? this.seedUsed : 0,
      busyUntil: old?.busyUntil || 0,
      cooldown: old?.cooldown || 0,
    };
  }
  status() {
    const s = this.state();
    return {
      configured: Boolean(this.key),
      mode: "shared",
      dailyBudget: this.budget,
      used: s.used,
      remaining: Math.max(0, this.budget - s.used),
      busy: s.busyUntil > this.now(),
      retryAfter: Math.max(0, Math.ceil((s.cooldown - this.now()) / 1000)),
      resetsAt: resetTime(this.now()),
    };
  }
  async search(kind, input) {
    const exclusions = kind === "exclusions",
      q = (exclusions ? exclusionQuery : samQuery)(input, this.countries);
    const cacheKey = "cache:" + kind + JSON.stringify(q),
      cached = this.store.get(cacheKey);
    if (cached && this.now() - cached.at < 1800000)
      return { ...cached.data, cached: true };
    if (!this.key)
      throw new PublicError("Hosted SAM connection is not configured.", 503);
    const s = this.state();
    if (s.cooldown > this.now())
      throw new PublicError(
        "SAM requested a pause. Try again in one minute.",
        429,
      );
    if (s.busyUntil > this.now())
      throw new PublicError(
        "Another shared SAM lookup is running. Retry shortly.",
        409,
      );
    if (s.used >= this.budget)
      throw new PublicError(
        "Shared daily SAM allowance reached. Cached searches remain available. Check the reset time above.",
        429,
      );
    const lease = crypto.randomUUID();
    this.store.set("quota", {
      ...s,
      used: s.used + 1,
      busyUntil: this.now() + 45000,
      lease,
    });
    try {
      let res;
      try {
        res = await this.fetchImpl(
          (exclusions ? exclusionURL : samURL)(q, this.key),
          { redirect: "manual", signal: AbortSignal.timeout(35000) },
        );
      } catch {
        throw new PublicError(
          "SAM connection timed out or failed. Retry later.",
          502,
        );
      }
      if (res.status === 429) {
        const current = this.store.get("quota");
        this.store.set("quota", { ...current, cooldown: this.now() + 60000 });
      }
      if (!res.ok) {
        // Only fixed diagnostic messages leave the service, never raw bodies/URLs.
        let category = "";
        if (res.status === 400) {
          try {
            const d = await boundedJSON(res.body, 16384);
            const message = String(d.message || "");
            if (/includeSections/.test(message))
              category = " SAM rejected the requested response sections.";
            else if (/recordStatus/.test(message))
              category = " SAM rejected the requested record status.";
            else if (/api.?key|credential|authoriz/i.test(message))
              category = " SAM rejected this key's access.";
          } catch {
            /* No raw diagnostic data leaves the gateway. */
          }
        }
        throw new PublicError(
          `SAM lookup failed (HTTP ${res.status}).${category} No eligibility conclusion can be drawn.`,
          res.status === 429 ? 429 : 502,
        );
      }
      const data = await boundedJSON(res.body, 2000000);
      let result;
      try {
        result = (exclusions ? publicExclusionPage : publicSamPage)(
          data,
          q,
          this.countries,
          new Date(this.now()).toISOString(),
        );
      } catch {
        throw new PublicError(
          "SAM returned an unexpected public response. No results accepted.",
          502,
        );
      }
      this.store.set(cacheKey, { at: this.now(), data: result });
      this.store.pruneCache(100);
      return { ...result, cached: false };
    } finally {
      const current = this.store.get("quota");
      if (current?.lease === lease)
        this.store.set("quota", { ...current, busyUntil: 0 });
    }
  }
}
