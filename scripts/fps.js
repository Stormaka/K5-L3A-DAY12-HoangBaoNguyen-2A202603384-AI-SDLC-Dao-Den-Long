// Measures real FPS of the 3D client at 1280x720 in Chrome via the DevTools protocol.
// Usage: node scripts/fps.js [gpu|swiftshader] [url-query]   (needs `PORT=5199 npm start` running)
// Prints the page title written by ?fpsreport (avg/min FPS over 10 s of a moving camera).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mode = process.argv[2] || 'gpu';
const query = process.argv[3] || 'autostart&night=3&seed=4&lit=7&t=900&demo&fpsreport';
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const flags = mode === 'gpu' ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const port = 9333;
const proc = spawn(chrome, ['--headless=new', ...flags, '--window-size=1280,720', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-chrome-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) pending.get(d.id)(d.result);
  };
  const send = (method, params = {}) => new Promise((r) => {
    pending.set(++id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.navigate', { url: `http://localhost:5199/?${query}` });
  let title = '';
  for (let i = 0; i < 40 && !title.startsWith('FPS') && !title.startsWith('ERR'); i++) {
    await sleep(1000);
    title = (await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true })).result.value;
  }
  console.log(`${mode}: ${title}`);
  ws.close();
} finally {
  proc.kill();
}
