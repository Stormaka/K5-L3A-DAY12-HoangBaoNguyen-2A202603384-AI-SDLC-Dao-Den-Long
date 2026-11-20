#!/usr/bin/env node
// Benchmark (Ticket-04 §1): opens the real 3D client in a Chrome window, 1280x720, vsync off, runs the
// standard bench scene (?bench) and writes bench.json.   Needs Google Chrome / Chromium / Edge.
// Usage: node scripts/bench.js --seed 42 --duration 30 --out bench.json [--headless] [--chrome <path>]
//   load_ms     = process start -> first frame of the bench scene
//   peak_mem_mb = highest RSS of the browser process tree (main + GPU + renderer) while measuring
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir, platform, release, arch, cpus, totalmem, type } from 'node:os';
import { join, dirname, resolve, delimiter } from 'node:path';
import { startServer } from '../server.js';

const procStart = Date.now() - process.uptime() * 1000;
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : d;
};
const seed = Number(arg('--seed', 42));
const duration = Number(arg('--duration', 30));
const out = arg('--out', 'bench.json');
const headless = process.argv.includes('--headless');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};
if (!Number.isInteger(seed) || !(duration > 0)) fail('usage: node scripts/bench.js --seed <int> --duration <s> --out <file>');
// The DevTools connection uses Node's built-in WebSocket (Node >= 22). The game itself only needs Node >= 18.
if (typeof WebSocket === 'undefined') fail(`the benchmark needs Node >= 22 (built-in WebSocket); this is Node ${process.version}`);

function findChrome() {
  const cand = [arg('--chrome'), process.env.CHROME];
  if (platform() === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      cand.push(join(base, 'Google/Chrome/Application/chrome.exe'), join(base, 'Microsoft/Edge/Application/msedge.exe'), join(base, 'Chromium/Application/chrome.exe'));
    }
  } else if (platform() === 'darwin') {
    cand.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    for (const dir of (process.env.PATH || '').split(delimiter)) for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) cand.push(join(dir, n));
  }
  return cand.find((c) => c && existsSync(c));
}

/** Sum of RSS (MB) of rootPid and all its descendants, from rows [pid, ppid, mb]. */
function treeSum(rows, rootPid) {
  const kids = new Map();
  for (const [pid, ppid] of rows) (kids.get(ppid) || kids.set(ppid, []).get(ppid)).push(pid);
  const rss = new Map(rows.map(([pid, , mb]) => [pid, mb]));
  let sum = 0;
  const stack = [rootPid];
  const seen = new Set();
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    sum += rss.get(p) || 0;
    stack.push(...(kids.get(p) || []));
  }
  return sum;
}

/**
 * Windows: read each browser process's PeakWorkingSetSize ONCE, after the measurement and before
 * Chrome is closed. Polling WMI/PowerShell during the run caused frame spikes (1% low fell below 30),
 * so nothing runs while frames are measured. Sum of per-process peaks = upper bound of the tree's peak.
 */
function windowsPeakMb(rootPid, exeName) {
  try {
    const txt = execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='${exeName}'" | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.PeakWorkingSetSize)" }`], { encoding: 'utf8', windowsHide: true });
    // PeakWorkingSetSize is reported in KB
    return treeSum(txt.trim().split(/\r?\n/).filter(Boolean).map((l) => l.trim().split(/\s+/).map(Number)).map(([pid, ppid, kb]) => [pid, ppid, kb / 1024]), rootPid);
  } catch {
    return null;
  }
}

/** Linux/macOS: sample `ps` every 2 s while measuring (cheap). Returns { latestMb(), stop() }. */
function memorySampler(rootPid) {
  let latest = null;
  if (platform() === 'win32') return { latestMb: () => null, stop() {} };
  const timer = setInterval(() => {
    try {
      const txt = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' });
      latest = treeSum(txt.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number)).map(([pid, ppid, kb]) => [pid, ppid, kb / 1024]), rootPid);
    } catch {}
  }, 2000);
  return { latestMb: () => latest, stop: () => clearInterval(timer) };
}

const chromePath = findChrome();
if (!chromePath) fail('Chrome/Chromium/Edge not found. Install Google Chrome or pass --chrome <path> (or set CHROME).');

const server = await startServer(0, false);
const port = server.address().port;
const dbgPort = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
const flags = [
  `--remote-debugging-port=${dbgPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', // vsync off (Chromium flags)
  '--window-size=1280,760', '--window-position=40,40', '--app=about:blank',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--ignore-gpu-blocklist',
  '--force_high_performance_gpu', // laptops with two GPUs: use the discrete one (the game also asks for powerPreference high-performance)
];
if (headless) flags.push('--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
const chrome = spawn(chromePath, flags, { stdio: 'ignore' });
const exeName = chromePath.split(/[\\/]/).pop();
let mem = { latestMb: () => null, stop() {} }; // started after the first frame (warm-up), so it cannot slow the load
let exitCode = 1;
const cleanup = () => {
  mem.stop();
  try {
    chrome.kill();
  } catch {}
  server.close();
  setTimeout(() => {
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
    process.exit(exitCode);
  }, 500);
};
const deadline = setTimeout(() => {
  console.error('error: benchmark timed out');
  cleanup();
}, (duration + 90) * 1000);

try {
  let target;
  let version = {};
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(250);
    try {
      version = await (await fetch(`http://127.0.0.1:${dbgPort}/json/version`)).json();
      target = (await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json()).find((t) => t.type === 'page');
    } catch {}
  }
  if (!target) throw new Error('could not connect to Chrome DevTools');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, ko) => ((ws.onopen = ok), (ws.onerror = ko)));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) pending.get(d.id)(d.result || {});
  };
  const send = (method, params = {}) => new Promise((ok) => {
    pending.set(++id, ok);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;

  // exactly 1280x720 CSS pixels, device pixel ratio 1
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://localhost:${port}/?bench&seed=${seed}&duration=${duration}` });

  let peak = 0;
  let st = {};
  while (!st.result) {
    await sleep(200);
    st = (await evalJs('({ phase: window.__benchPhase, first: window.__benchFirstFrame, result: window.__benchResult, title: document.title })')) || {};
    if (String(st.title || '').startsWith('ERR')) throw new Error(`page error: ${st.title}`);
    if (st.first && !mem.started) mem = { ...memorySampler(chrome.pid), started: true };
    if (st.phase === 'measure' && mem.latestMb() != null) peak = Math.max(peak, mem.latestMb());
  }
  if (platform() === 'win32') peak = windowsPeakMb(chrome.pid, exeName) || 0; // after measuring, Chrome still open
  const r = st.result;
  const report = {
    contract_version: '1.3',
    avg_fps: r.avg_fps,
    p1_low_fps: r.p1_low_fps,
    frame_ms_p95: r.frame_ms_p95,
    frames: r.frames,
    load_ms: Math.round(st.first - procStart),
    peak_mem_mb: peak ? Math.round(peak) : null,
    vsync_off: true,
    renderer: `three.js r${r.three} on ${r.webgl}; GPU: ${r.gpu}; ${version.Browser || 'Chrome'}${headless ? ' (headless, SwiftShader)' : ''}`,
    os: `${type()} ${release()} ${arch()}; CPU ${cpus()[0]?.model.trim()} x${cpus().length}; RAM ${Math.round(totalmem() / 1073741824)} GB`,
    seed,
    duration_s: duration,
    viewport: r.viewport,
    scene: { shades: r.shades, motes: r.motes, lit: r.lit },
    worst_frames: process.env.BENCH_DEBUG ? r.worst : undefined,
    peak_mem_note: platform() === 'win32'
      ? 'Windows: sum of PeakWorkingSetSize of the browser process tree (main + GPU + renderer + utility), read once after measuring so sampling cannot disturb frame times; upper bound of the true simultaneous peak'
      : 'sum of RSS of the browser process tree (main + GPU + renderer + utility), sampled every 2 s while measuring',
  };
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(`bench: avg ${report.avg_fps} fps, 1% low ${report.p1_low_fps} fps, p95 ${report.frame_ms_p95} ms, ${report.frames} frames, load ${report.load_ms} ms, peak ${report.peak_mem_mb} MB -> ${out}`);
  exitCode = 0;
  ws.close();
} catch (e) {
  console.error(`error: ${e.message}`);
} finally {
  clearTimeout(deadline);
  cleanup();
}
