---
name: verify-game
description: Run the game's verification and save evidence for the current phase (tests, headless scenarios via the real CLI for all 3 nights, determinism, timing, bot wins at dawn, screenshots incl. colour-blind mode, FPS). Use before tagging a phase or when asked to "verify", "prove", or "collect evidence".
---

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
