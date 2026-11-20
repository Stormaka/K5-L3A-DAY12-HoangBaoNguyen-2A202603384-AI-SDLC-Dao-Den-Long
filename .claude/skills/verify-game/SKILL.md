---
name: verify-game
description: Run the game's verification and save evidence for the current phase (tests, headless scenarios via the real CLI, determinism, screenshots). Use before tagging a phase or when asked to "verify", "prove", or "collect evidence".
---

# Verify Đảo Đèn Lồng and save evidence

1. `npm test 2>&1 | tee docs/proof/<phase>/test-report.txt` — all must pass. If red: fix code, never the assertion (unless a ticket changed the rule → note it in docs/notes/<phase>.md).
2. `npm run proof -- <phase>` — runs scenarios in `scripts/proof.js` through `headless_cmd`, twice each (determinism), writes `docs/proof/<phase>/headless-evidence.md` + `runs/*.jsonl`. Add new cases there for new ticket rules.
3. If the bot scenario must be regenerated (rules changed): `node scripts/bot.js 1 tests/scenarios/win-seed1.inputs.json`.
4. Screenshots (visual-only requirements): start `PORT=5199 node server.js`, then
   `chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=docs/proof/<phase>/img/<name>.png "http://localhost:5199/?autostart&seed=3&lit=K"`
   Open the PNG and check it really shows the requirement.
5. Update the traceability table in `docs/proof/<phase>/README.md` (requirement → how → evidence → PASS/NOT MET). Write NOT MET honestly.
