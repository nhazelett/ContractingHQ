// Local browser fixture only. It never connects to production services or writes records.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mentor = { id: 'b'.repeat(64), name: 'Local test mentor', rank: 'SSgt', field: 'Contracting', role: 'Test role', bio: 'Local test bio.', philosophy: 'A local browser fixture, not a published contribution.' };
const take = { id: 'local-test', topicSlug: 'leadership-for-people-who-just-got-handed-it', createdAt: '2026-11-09T10:00:00Z', mentor, body: 'Local fixture text.\n\n<img src=x onerror=alert(1)>\n\nThis markup must appear as text.' };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:9138');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/working-theory/site-config.js') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end('window.KTHQ_WORKING_THEORY=' + JSON.stringify({ apiBase: url.origin, publishedTopics: [], turnstileSiteKey: '' }));
  }
  if (url.pathname.startsWith('/topics/')) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ takes: [take], cursor: null })); }
  if (url.pathname === '/mentors/' + mentor.id) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ mentor })); }
  if (url.pathname === '/mentors/' + mentor.id + '/takes') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ takes: [take], cursor: null })); }
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'working-theory/index.html';
  const file = path.resolve(root, relative.endsWith('/') ? relative + 'index.html' : relative);
  if (!file.startsWith(root + path.sep) || /(?:^|[\\/])(?:\.[^\\/]+|node_modules|_internal)(?:[\\/]|$)/.test(relative)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (error, bytes) => { if (error) { res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(bytes); });
}).listen(9138, '127.0.0.1', () => console.log('Local fixture: http://127.0.0.1:9138/working-theory/leadership-for-people-who-just-got-handed-it.html'));
