# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js, browser) + deterministic headless mode for automatic grading (Test Contract v1.0).

## Commands
- Install: `npm install` · Play: `npm start` → http://localhost:5173
- Tests: `npm test` (node:test, must stay green) · Evidence: `npm run proof` (writes docs/proof/<phase>/)
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl`

## Layout
- `src/sim/` pure game logic. NO DOM, NO Date/Math.random/wall clock (determinism). Shared by web + headless.
- `src/sim/config.js` = the ONLY place for gameplay numbers. `game.contract.json` tuning must mirror it (test C-01).
- `src/headless.js` CLI + exit codes (2 = malformed inputs/scenario). `web/` rendering + input only.
- `tests/` acceptance tests named AC-xx / C-xx → traced in `docs/proof/<phase>/README.md`.

## Rules
- The contract text is the spec. Never invent requirements; ambiguity → record an assumption in `docs/notes/<phase>.md`.
- Write/adjust the test FIRST, then code. Never weaken a test to make it pass; if a new ticket invalidates a test, change it and write why in the notes.
- Events in step k carry tick k+1. Coordinates rounded to 3 decimals only at output.
- Do not commit `.env`, keys, `node_modules/`.
- "Done" = `npm test` green + `npm run proof` PASS (a Stop hook enforces tests).
