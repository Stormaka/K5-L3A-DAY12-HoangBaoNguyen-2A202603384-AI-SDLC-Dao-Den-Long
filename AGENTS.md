# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js, browser), 3 nights, + deterministic headless mode for automatic grading (Test Contract **v1.1**).

## Commands
- Install: `npm install` · Play: `npm start` → http://localhost:5173
- Tests: `npm test` (node:test, must stay green) · Evidence: `npm run proof` (writes docs/proof/phase-2/)
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out/run.jsonl`
- Bot (proves a night is winnable, records inputs): `npm run bot -- <night> <seed> <out.json>`
- FPS: `PORT=5199 npm start` then `npm run fps` (Chrome via DevTools protocol)

## Layout
- `src/sim/` pure game logic. NO DOM, NO Date/Math.random/wall clock (determinism). Shared by web + headless.
- `src/sim/config.js` = the ONLY place for gameplay numbers: `TUNING` = contract keys (mirror in `game.contract.json`, test C-01), `WORLD` = other Ticket-02 standard numbers + documented assumptions.
- `src/sim/maps.js` = standard maps for Nights 1-3 (lanterns, spawn points, ground height, walls, pads, charms). Angles: from +X, CCW from above → (r cos a, r sin a) on (x, z).
- `src/sim/world.js` `step()` follows Ticket-02's per-tick order (input/pause → timers → move+fall → pickup → interact → safe zones → pulse → shades/drifters → contact → spawns → win/lose). Keep that order.
- `src/headless.js` CLI + exit codes (2 = malformed inputs/scenario). `web/` rendering, input, audio, menus only.
- `tests/` acceptance tests AC-xx (Phase 1), P2-xx (Phase 2), C-xx (contract) → traced in `docs/proof/<phase>/README.md`. Headless scenario files in `tests/scenarios/`.

## Rules
- The ticket/contract text is the spec. Never invent requirements; ambiguity → record an assumption in `docs/notes/<phase>.md` (A2-xx for Phase 2).
- Write/adjust the test FIRST (expected numbers computed by hand in a comment), then code. Never weaken a test to make it pass; if a ticket changes a rule, change the test, mark it `T<n>:` and say why in the notes.
- Events in step k carry tick k+1. `night_start` is the only event at tick 0. Coordinates rounded to 3 decimals only at output.
- Optional extras must not change headless output (disable them in headless).
- Patch files with the Edit tool, not shell heredocs (they have corrupted `\` and `\n` twice).
- Open every screenshot before using it as evidence.
- Do not commit `.env`, keys, `node_modules/`. Never push/tag without the user's explicit yes.
- "Done" = `npm test` green + `npm run proof` all PASS (Stop hook, git pre-push hook and CI on Node 20/22/24 enforce tests).
