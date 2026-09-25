import { SAM_SERVICE } from "../ocs-atlas/service-config.mjs";
// Local-only preview and SAM public-data gateway. Never expose this server on a network.
import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, relative, extname, join, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { createSamGateway } from "./ocs-sam-gateway.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const stateDir = join(process.env.LOCALAPPDATA || homedir(), "KTHQ", "ocs");
export function createAtlasServer({ gateway, siteRoot = root }) {
  return createServer(async (req, res) => {
    const host = "127.0.0.1:" + req.socket.localPort,
      origin = "http://" + host;
    const reply = (code, body) => {
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body));
    };
    if (req.headers.host !== host)
      return reply(403, { error: "Local preview requests only." });
    let url;
    try {
      url = new URL(req.url, origin);
    } catch {
      return reply(400, { error: "Invalid request." });
    }
    if (url.pathname.startsWith("/api/")) {
      if (req.headers.origin && req.headers.origin !== origin)
        return reply(403, {
          error: "Cross-origin API requests are not permitted.",
        });
      try {
        if (url.pathname === "/api/sam/status" && req.method === "GET")
          return reply(200, await gateway.status());
        if (
          !["/api/sam/entities", "/api/sam/exclusions"].includes(
            url.pathname,
          ) ||
          req.method !== "POST"
        )
          return reply(404, { error: "Unknown local API route." });
        if (
          req.headers["x-ocs-request"] !== "1" ||
          req.headers["content-type"] !== "application/json"
        )
          return reply(415, { error: "Use the atlas SAM search controls." });
        let body = "",
          size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > 4096) {
            reply(413, { error: "Search request too large." });
            return;
          }
          body += c;
        }
        let input;
        try {
          input = JSON.parse(body);
        } catch {
          return reply(400, { error: "Invalid search request." });
        }
        return reply(
          200,
          await (url.pathname === "/api/sam/exclusions"
            ? gateway.searchExclusions(input)
            : gateway.search(input)),
        );
      } catch (e) {
        return reply(400, { error: e.message });
      }
    }
    if (!["GET", "HEAD"].includes(req.method))
      return reply(405, { error: "Method not supported." });
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css",
      ".mjs": "text/javascript",
      ".js": "text/javascript",
      ".json": "application/json",
      ".gz": "application/gzip",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".jpg": "image/jpeg",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
      ".woff2": "font/woff2",
      ".txt": "text/plain",
      ".pdf": "application/pdf",
    };
    try {
      const pathname = decodeURIComponent(url.pathname);
      if (
        pathname.includes("\\") ||
        pathname.split("/").some((p) => p.startsWith(".") && p !== "")
      )
        return reply(404, { error: "Not found." });
      const path = await realpath(
        resolve(
          siteRoot,
          "." + (pathname === "/" ? "/ocs-supplier-atlas.html" : pathname),
        ),
      );
      const rel = relative(await realpath(siteRoot), path);
      if (
        rel.startsWith("..") ||
        isAbsolute(rel) ||
        /^(scripts|tests|node_modules)([\\/]|$)/i.test(rel) ||
        !types[extname(path)] ||
        !(await stat(path)).isFile()
      )
        return reply(404, { error: "Not found." });
      res.writeHead(200, {
        "Content-Type": types[extname(path)],
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : await readFile(path));
    } catch {
      reply(404, { error: "Not found." });
    }
  });
}
async function main() {
  const port = Number(process.env.OCS_PORT || 8897);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid OCS_PORT.");
  const countries = JSON.parse(
    await readFile(
      new URL("../ocs-atlas/data/countries.json", import.meta.url),
      "utf8",
    ),
  );
  const getKey = async () => {
    if (process.env.SAM_API_KEY) return process.env.SAM_API_KEY.trim();
    const path =
      process.env.SAM_PUBLIC_KEY_FILE || join(stateDir, "sam-public-key.txt");
    try {
      const actual = await realpath(path),
        rel = relative(await realpath(root), actual);
      if (!rel.startsWith("..") && !/^[A-Za-z]:/.test(rel))
        throw new Error("Key must be outside the web root");
      return (await readFile(actual, "utf8")).trim();
    } catch (e) {
      if (e.code === "ENOENT") return "";
      throw new Error(
        "Cannot use this key file. Keep the SAM public key outside the project and check file access.",
      );
    }
  };
  // All local and hosted atlas users share the cloud quota and sanitized cache.
  const hostedCall = async (path, input) => {
    const res = await fetch(SAM_SERVICE + path, {
      method: input ? "POST" : "GET",
      headers: {
        Origin: "https://kthq.org",
        "Content-Type": "application/json",
        "X-OCS-Request": "1",
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
      signal: AbortSignal.timeout(40000),
      redirect: "error",
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || "Hosted SAM lookup unavailable.");
    return data;
  };
  const gateway = SAM_SERVICE
    ? {
        status: () => hostedCall("/api/sam/status"),
        search: (q) => hostedCall("/api/sam/entities", q),
        searchExclusions: (q) => hostedCall("/api/sam/exclusions", q),
      }
    : createSamGateway({
        getKey,
        countries,
        usageFile: join(stateDir, "sam-usage.json"),
        budget: Number(process.env.SAM_DAILY_BUDGET || 10),
      });
  const server = createAtlasServer({ gateway, port });
  server.on("error", () => {
    console.error(
      "Local atlas server could not start. Check whether the port is already in use.",
    );
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(
      "OCS local preview: http://127.0.0.1:" +
        port +
        "/ocs-supplier-atlas.html",
    ),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error("Local atlas setup failed. Check configuration.");
    process.exitCode = 1;
  });
