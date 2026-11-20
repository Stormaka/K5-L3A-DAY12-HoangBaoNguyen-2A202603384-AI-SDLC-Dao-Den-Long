---
name: verify-game
description: Run the game's verification and save evidence for the current phase (tests, headless scenarios via the real CLI for all 3 nights, determinism, timing, bot wins at dawn, screenshots incl. colour-blind mode, benchmark, soak, release bundle). Use before tagging a phase or when asked to "verify", "prove", or "collect evidence".
---

Release checks (Ticket-04), run one at a time on an idle machine:
- `node scripts/bench.js --seed 42 --duration 30 --out docs/proof/<phase>/bench.json` → avg_fps >= 60, p1_low_fps >= 30, load_ms <= 10000. Run it 2-3 times and report the range; use `BENCH_DEBUG=1` to get the 12 worst frames split into late/sync/hud/render.
- `node --expose-gc scripts/soak.js --seed 7 --nights 10 --out docs/proof/<phase>/soak.json` → crashes 0, mem_end <= 1.2 x mem_start. Repeat 5x; a 60-night run shows whether memory really grows.
- `npm run package`, then run `node server.js` and `node scripts/run-tests.js` INSIDE `dist/dao-den-long-v*/` (proves the bundle needs no npm install).
- Screens: `?screen=board|save|keys&dup`, captions `?autostart&night=1&t=290&god`, `?large`, `?bench`.

# Verify Đảo Đèn Lồng and save evidence

1. `npm test > docs/proof/<phase>/test-report.txt 2>&1` — all must pass. If red: fix code, never the assertion (unless a ticket changed the rule → mark the test `T<n>:` and note it in docs/notes/<phase>.md).
2. `node scripts/proof.js <phase>` — runs every case in `scripts/proof.js` through `headless_cmd` (each with `--night`), twice each (determinism), checks per-case expectations and ≤ 30 s, writes `docs/proof/<phase>/headless-evidence.md` + `runs/*.jsonl`. Add a case (and a `tests/scenarios/*.json` file) for every new ticket feature.
3. If rules changed, regenerate the winning runs and check every night is still winnable:
   `node scripts/bot.js <night> <seed> tests/scenarios/win-n<night>-seed<seed>.inputs.json` for nights 1-3 (exit 0 = won at dawn). Try several seeds and report the win rate as balance data; reference the winning file in scripts/proof.js.
4. Screenshots: start `PORT=5199 node server.js`, then in **PowerShell** (bash paths do not work with Chrome on Windows):
   `Start-Process chrome -ArgumentList '--headless=new','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1280,720','--virtual-time-budget=4000',"--screenshot=<abs path>.png",'http://localhost:5199/?autostart&night=N&seed=S&lit=K&t=TICKS' -Wait`
   Overlays: `?screen=menu|intro|pause|settings|result|dawn`. Add `&cb` for the colour-blind palette, `&god` so Mây survives long `t=` runs (screenshots only). Open each PNG and check it really shows the requirement.
5. FPS (needs a real GPU): `node scripts/fps.js gpu "autostart&night=3&seed=4&lit=7&t=900&demo&fpsreport"` → avg/min FPS and count of frames < 30 FPS at 1280×720.
6. Update the traceability table in `docs/proof/<phase>/README.md` (requirement → how → evidence → Đạt / Chưa kiểm chứng). Write unverified items honestly (audio, hand-play feel).
