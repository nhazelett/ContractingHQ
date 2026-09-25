import { boundedJSON, PublicError } from "./gateway.mjs";
const allowed = new Set([
  "https://kthq.org",
  "https://www.kthq.org",
  "http://127.0.0.1:8897",
]);
export async function handleRequest(request, env) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
  if (allowed.has(origin))
    Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-OCS-Request",
      "Access-Control-Max-Age": "600",
    });
  const reply = (status, body) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!allowed.has(origin))
    return reply(403, {
      error: "Use the KTHQ Supplier Atlas to access this service.",
    });
  const path = new URL(request.url).pathname;
  if (
    !["/api/sam/status", "/api/sam/entities", "/api/sam/exclusions"].includes(
      path,
    )
  )
    return reply(404, { error: "Unknown route." });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  try {
    const permit = await env.SEARCH_LIMIT.limit({
      key: request.headers.get("CF-Connecting-IP") || "unknown",
    });
    if (!permit.success)
      return reply(429, {
        error: "Too many atlas requests. Wait a minute and try again.",
      });
    const stub = env.SAM.getByName("public-sam-credential-v1");
    if (path === "/api/sam/status" && request.method === "GET")
      return reply(200, await stub.status());
    if (request.method !== "POST" || path === "/api/sam/status")
      return reply(405, { error: "Method not supported." });
    if (
      request.headers.get("X-OCS-Request") !== "1" ||
      request.headers.get("Content-Type") !== "application/json"
    )
      return reply(415, { error: "Use the atlas SAM controls." });
    const input = await boundedJSON(request.body, 4096);
    const outcome = await stub.search(
      path.endsWith("exclusions") ? "exclusions" : "entities",
      input,
    );
    return reply(outcome.status, outcome.body);
  } catch (e) {
    return reply(e instanceof PublicError ? e.status : 503, {
      error:
        e instanceof PublicError
          ? e.message
          : "SAM service unavailable. Retry later.",
    });
  }
}
