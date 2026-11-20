// Tiny static server for the 3D client (no build step). Usage: npm start  [PORT=5173]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 5173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };
const allowed = ['web', 'src', join('node_modules', 'three')];

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/web/index.html';
  const rel = normalize(path).replace(/^[\\/]+/, '');
  if (!allowed.some((a) => rel === a || rel.startsWith(a + sep))) {
    res.writeHead(404).end('not found');
    return;
  }
  try {
    const body = await readFile(join(root, rel));
    res.writeHead(200, { 'content-type': types[extname(rel)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`Đảo Đèn Lồng: open http://localhost:${port}`));
