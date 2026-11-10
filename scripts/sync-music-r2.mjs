// Upload music originals before publishing pages that reference them.
// Existing, identical files are verified and skipped. No objects are deleted.
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://music.kthq.org/';
const wrangler = resolve(root, 'working-theory-worker/node_modules/wrangler/bin/wrangler.js');
const verifyOnly = process.argv.includes('--verify-only');
const files = [];
async function collect(dir, recursive) {
  for (const entry of await readdir(resolve(root, dir), { withFileTypes: true })) {
    const name = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory() && recursive) await collect(name, true);
    else if (entry.isFile() && /\.mp3$/i.test(entry.name)) files.push(name);
  }
}
await collect('', false);
// Only the published library directories; local album source folders stay local.
await collect('audio', false);
await collect('audio/cco', false);
await collect('audio/ollie', false);
await collect('ollie', false);

function command(args) {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
    });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? accept() : reject(new Error(`Wrangler exited ${code}`)));
  });
}
async function verify(path, bytes) {
  const url = new URL(path, origin);
  const headers = { 'User-Agent': 'KTHQ-music-verification', Origin: 'https://kthq.org' };
  const head = await fetch(url, { method: 'HEAD', headers, signal: AbortSignal.timeout(30000) });
  const md5 = createHash('md5').update(bytes).digest('hex');
  if (!head.ok || Number(head.headers.get('content-length')) !== bytes.length ||
      head.headers.get('etag')?.replaceAll('"', '') !== md5 ||
      head.headers.get('content-type') !== 'audio/mpeg') return false;
  const start = Math.floor(bytes.length / 2);
  const end = Math.min(start + 1023, bytes.length - 1);
  const part = await fetch(url, { headers: { ...headers, Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(30000) });
  const body = Buffer.from(await part.arrayBuffer());
  return part.status === 206 &&
    part.headers.get('content-range') === `bytes ${start}-${end}/${bytes.length}` &&
    part.headers.get('access-control-allow-origin') === headers.Origin &&
    body.equals(bytes.subarray(start, end + 1));
}
let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < files.length) {
    const path = files[cursor++];
    const bytes = await readFile(resolve(root, path));
    if (await verify(path, bytes)) { console.log(`Verified: ${path}`); continue; }
    if (verifyOnly) throw new Error(`Public audio verification failed: ${path}`);
    await command(['r2', 'object', 'put', `kthq-music/${path}`, '--file', resolve(root, path),
      '--remote', '--content-type', 'audio/mpeg', '--cache-control', 'public, max-age=86400', '--force']);
    if (!await verify(path, bytes)) throw new Error(`Uploaded audio verification failed: ${path}`);
  }
}));
console.log(`All ${files.length} music originals verified on R2.`);
