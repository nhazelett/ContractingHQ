import { DurableObject } from "cloudflare:workers";
import countries from "../ocs-atlas/data/countries.json";
import { SharedSamGateway, PublicError } from "./gateway.mjs";
import { handleRequest } from "./http.mjs";
export class SamQuota extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = this.ctx.storage.sql;
    sql.exec(
      "CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL, touched INTEGER NOT NULL)",
    );
    const store = {
      get: (key) => {
        const row = sql
          .exec("SELECT value FROM state WHERE key=?", key)
          .toArray()[0];
        return row ? JSON.parse(row.value) : null;
      },
      set: (key, value) =>
        sql.exec(
          "INSERT OR REPLACE INTO state(key,value,touched) VALUES(?,?,?)",
          key,
          JSON.stringify(value),
          Date.now(),
        ),
      pruneCache: (limit) =>
        sql.exec(
          "DELETE FROM state WHERE key IN (SELECT key FROM state WHERE key LIKE 'cache:%' ORDER BY touched DESC LIMIT -1 OFFSET ?)",
          limit,
        ),
    };
    this.gateway = new SharedSamGateway({
      store,
      key: this.env.SAM_API_KEY?.trim(),
      countries,
      budget: Number(this.env.SAM_DAILY_BUDGET),
      seedDay: this.env.INITIAL_USAGE_DAY,
      seedUsed: Number(this.env.INITIAL_USAGE_COUNT || 0),
    });
  }
  status() {
    return this.gateway.status();
  }
  async search(kind, input) {
    try {
      return { status: 200, body: await this.gateway.search(kind, input) };
    } catch (e) {
      return {
        status: e instanceof PublicError ? e.status : 400,
        body: {
          error:
            e instanceof PublicError
              ? e.message
              : "Invalid SAM query or unavailable service.",
        },
      };
    }
  }
}
export default { fetch: handleRequest };
