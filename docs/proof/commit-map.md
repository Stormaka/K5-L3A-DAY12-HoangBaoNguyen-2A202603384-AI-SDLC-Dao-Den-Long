# Đối chiếu mã commit (trước / sau khi bỏ dòng đồng tác giả)

Trước lần push đầu tiên của Phase 2–4, theo yêu cầu của tác giả, dòng `Co-Authored-By: Claude …` được bỏ khỏi thông điệp của 14 commit **chưa từng lên GitHub** (sau `9a31de2`). Vì vậy các mã commit dưới đây đã đổi.

- **Nội dung không đổi:** cây file của commit cuối trước và sau khi viết lại giống hệt nhau (cùng tree hash).
- **Ngày giờ không đổi:** thời gian tác giả và commit được giữ nguyên.
- **Không viết lại commit đã push:** `9a31de2`, tag `phase-1` và các commit trước đó giữ nguyên, nên push là fast-forward, không force push (RULES.md mục 7).
- Việc dùng AI vẫn được ghi đầy đủ trong [CREDITS.md](../../CREDITS.md), `docs/notes/phase-*.md` và [docs/retro.md](../retro.md).

Các file bằng chứng ghi mã cũ (dòng "Commit:" trong `headless-evidence.md`, báo cáo kiểm toán) tương ứng với mã mới theo bảng sau:

| Mã cũ | Mã mới | Commit |
|---|---|---|
| `2283a32` | `1cfc742` | Phase 2: Ticket-02 standard numbers, 3 standard maps, Test Contract v1.1 |
| `b95c488` | `ad2d32a` | Phase 2: web client for 3 nights, menus, pause, settings, audio, full HUD |
| `9a04316` | `0105571` | Harness: update AGENTS.md and verify-game skill for 3 nights / contract v1.1 |
| `f2a5765` | `e6faf25` | Phase 2 evidence: notes (assumptions, ACs, AI log), traceability, headless runs, screenshots, FPS |
| `a267869` | `9368482` | Phase 3: lantern fuel, drain, dawn win, capacity, Test Contract v1.2 |
| `088c7f9` | `4fc8aff` | Phase 3 client: fuel bars, low-fuel blink, drain beams, colour-blind palette, capacity HUD |
| `3bc30c2` | `dd32dec` | Harness: AGENTS.md + verify-game skill for fuel rules, ADR rule, safer patching |
| `e73efbf` | `5ca58cf` | Phase 3 docs: ADR 0001, notes (assumptions, changed tests, AI log), breaking-change changelog, evidence |
| `517e66e` | `593348f` | Phase 4: benchmark scene, soak test, local leaderboard, packaging, Test Contract v1.3 |
| `63fcbdb` | `8ea9094` | Phase 4 client: instanced shades/motes, key rebinding, captions + shade arrows, reduced motion, 18px+ text, leaderboard UI, bench mode |
| `dd50820` | `6e97e95` | Harness: AGENTS.md + verify-game skill for bench/soak/release, performance rules |
| `4b2da53` | `edf9108` | Phase 4 docs: release README, CREDITS, CHANGELOG v1.0.0, notes, retro, demo/release guide, bench.json + soak.json evidence |
| `af4f182` | `1cabfb1` | Fix audit findings: bench shades keep roaming (A4-14), bench.js requires Node 22, .gitattributes for byte-exact evidence |
| `5b3fb34` | `fb79da5` | Independent audit report + responses; A2-21 assumption; re-measured bench with honest range |

Tag: `phase-2` → `e6faf25` (cũ `f2a5765`), `phase-3` → `5ca58cf` (cũ `e73efbf`). `phase-4` và `v1.0.0` trỏ vào commit cuối có file này.
