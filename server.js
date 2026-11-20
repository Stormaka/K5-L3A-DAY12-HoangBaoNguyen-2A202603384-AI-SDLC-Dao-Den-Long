// Tiny static server for the 3D client (no build step) + local leaderboard stored on disk.
// Usage:  node server.js [--port 5173]                     play at http://localhost:5173
//         node server.js --export-leaderboard out.json     write {"entries": [...]} and exit
// Leaderboard file: $DDL_DATA_DIR/leaderboard.json (default ./data/leaderboard.json, git-ignored).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, sep, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEntry } from './src/leaderboard.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const allowed = ['web', 'src', join('node_modules', 'three')];
export const dataFile = () => join(process.env.DDL_DATA_DIR || join(root, 'data'), 'leaderboard.json');

export function loadBoard() {
  try {
    const j = JSON.parse(readFileSync(dataFile(), 'utf8'));
    return Array.isArray(j.entries) ? j.entries : [];
  } catch {
    return [];
  }
}

async function saveBoard(entries) {
  const f = dataFile();
  await mkdir(dirname(f), { recursive: true });
  await writeFile(`${f}.tmp`, JSON.stringify({ entries }, null, 2));
  await rename(`${f}.tmp`, f); // atomic replace: a crash never leaves a half-written file
}

const json = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(obj));

async function api(req, res) {
  if (req.method === 'GET') return json(res, 200, { entries: loadBoard() });
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10000) return json(res, 413, { error: 'too large' });
  }
  try {
    const r = addEntry(loadBoard(), JSON.parse(body));
    await saveBoard(r.entries);
    return json(res, 200, r);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
}

export function startServer(port = 5173, log = true) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/api/leaderboard') return api(req, res);
    if (path === '/') path = '/web/index.html';
    const rel = normalize(path).replace(/^[\\/]+/, '');
    if (!allowed.some((a) => rel === a || rel.startsWith(a + sep))) return res.writeHead(404).end('not found');
    try {
      const body = await readFile(join(root, rel));
      res.writeHead(200, { 'content-type': types[extname(rel)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(port, () => {
    if (log) console.log(`Đảo Đèn Lồng: open http://localhost:${server.address().port}`);
    ok(server);
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--export-leaderboard');
  if (i >= 0) {
    const out = args[i + 1];
    if (!out) {
      console.error('error: --export-leaderboard needs a file path');
      process.exit(1);
    }
    await mkdir(dirname(resolve(out)), { recursive: true });
    await writeFile(out, JSON.stringify({ entries: loadBoard() }, null, 2) + '\n');
    console.log(`exported ${loadBoard().length} entries to ${out}`);
  } else {
    const p = args.indexOf('--port');
    await startServer(p >= 0 ? Number(args[p + 1]) : Number(process.env.PORT) || 5173);
  }
}
