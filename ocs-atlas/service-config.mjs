// Public service address only. SAM credentials are Cloudflare secrets, never page data.
export const SAM_SERVICE = "https://kthq-ocs-sam.nickhazelett.workers.dev";
export function samEndpoint(
  path,
  hostname = globalThis.location?.hostname || "127.0.0.1",
) {
  return ["127.0.0.1", "localhost", "[::1]"].includes(hostname)
    ? path
    : SAM_SERVICE + path;
}
