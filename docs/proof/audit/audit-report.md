# Báo cáo kiểm định độc lập: Đảo Đèn Lồng (Day 12 AI SDLC)

- Repo: `C:/Users/Acer/Downloads/2011/dao-den-long` (HEAD `4b2da53`, branch `main`)
- Ngày kiểm: 2026-11-20. Máy: i7-13620H, RTX 5050 Laptop, Windows 11, Node v24.16.0. **Đây không phải máy chấm.**
- Spec dùng để chấm: PRD-0 + Test Contract v1.0 (HTML lab board đã lưu), TICKET-02/03/04 (lấy nguyên văn từ transcript). Không dựa vào tóm tắt của sinh viên.
- Mọi file của auditor nằm trong `.../scratchpad/audit/` (bản clone ở `clone/`, probe ở `probes/`, kết quả ở `probes/out/`, `rerun/`, `soak.json`, `bench.json`). Repo gốc không bị sửa.

---

## 1. Bảng điểm

Điểm dưới đây giả định sinh viên **kịp** push commit và tạo tag `phase-2..4` + Release `v1.0.0` trước hạn. Nếu nộp đúng trạng thái hiện tại thì điểm thấp hơn nhiều (xem mục 4).

| Hạng mục | Điểm | Max | Ghi chú ngắn |
|---|---:|---:|---|
| A. Test ẩn | **23–27** (ước 25) | 30 | 47/47 kiểm tra trong 33 probe khớp kỳ vọng tôi tự tính từ spec. Rủi ro nằm ở vài giả định (trạng thái mặc định của shade trong scenario, `spawning` 60 tick, wander 2 m/s). **Hiện chỉ có tag `phase-1`**, nên ở trạng thái hiện tại A của Phase 2–4 có thể bị 0 |
| B. Kiểm chứng và bằng chứng | **17** | 20 | Truy vết 5/5, test và scenario 4/4, tự động hóa 3/3. Bằng chứng khớp mã 3/4: sha256 khớp nhưng tag không tồn tại. Agent tự kiểm 2/4: chưa có người hoặc agent khác đánh giá |
| C. Quy trình SDLC và harness | **13** | 15 | Giả định/AC 4, thay đổi yêu cầu 3, AGENTS.md 3, hook/skill 3. Git 0/2: thiếu 3 tag và Release, commit dồn cục |
| D. Evaluation và retro | **8.5** | 10 | Đánh giá từng phase 4, phân tích lỗi AI 2, retro 2. Token 0.5/2 vì chỉ là khoảng ước lượng, còn để chú thích "thay bằng số thật trước khi nộp" |
| E. Hiệu năng và ổn định | **8–10** (ước 9) | 10 | Bench tôi chạy lại: 325.5 / 95.4 FPS, load 2020 ms. Soak 0 crash, ×1.01. Rủi ro: bench cần Node ≥ 22 (`WebSocket` toàn cục), chưa thử trên Linux/macOS |
| F. Chất lượng sản phẩm | **8** | 10 | Đủ tính năng theo code và ảnh. Chưa ai chơi thử bằng tay. Cân bằng khó (bot thắng Đêm 2 3/7, Đêm 3 2/7). Bóng Mực tụ đứng yên ở đèn tắt |
| G. Video demo | **0** | 5 | Không có `.mp4`. README chỉ trỏ tới `docs/demo/README.md`, file đó là kịch bản quay |
| **Tổng** | **≈ 79–84 (ước 81)** | 100 | Phải gỡ các blocker ở mục 4 trước. Nếu không, có thể mất phần lớn A và C, cộng điểm trừ theo RUBRIC §6 |

### Giải thích từng hạng mục

**A (23–27/30).** Tôi viết 33 probe (scenario/inputs) thẳng từ chữ trong ticket và tính kỳ vọng trước khi chạy. Tất cả đều khớp: tick model, sự kiện ở tick k+1, pause/sim_tick, dash/cooldown, hit/invuln/drop, rơi khỏi đảo, pulse 3D + đẩy +X khi trùng vị trí, drifter, refuel/relight/fuel_out/drain, dawn win/lose, ưu tiên no_flames, capacity, mã thoát 0/1/2, tất định, một Đêm 21.600 tick chạy khoảng 0.25 s. Code bám rất sát thứ tự xử lý trong tick của Ticket-02/03. Tôi trừ khoảng 3–7 điểm vì một số chỗ ticket bỏ ngỏ, sinh viên tự giả định, và test ẩn có thể hiểu khác. Chi tiết ở mục 3. Phase 1 (tag `phase-1`, contract v1.0 với tuning tự chọn) vẫn chạy được ví dụ của contract.

**B (17/20).**
- Mỗi phase có `docs/proof/phase-N/README.md` (bảng yêu cầu → cách kiểm → bằng chứng → kết quả), `headless-evidence.md`, `runs/*.jsonl`, `test-report.txt` và ảnh. Mọi link trong 4 README đều trỏ tới file có thật.
- Tôi chạy lại 4 run trong `docs/proof/phase-4/headless-evidence.md` (P1-win-n1, P2-win-n3, P3-drain, P3-dawn-win). sha256 khớp **từng byte** với bảng và với blob trong git. Trên Windows, checkout có CRLF vì `autocrlf=true` và repo không có `.gitattributes`.
- `npm test`: 73/73 xanh trong 4.8 s trên clone sạch. Trong test có 358 lệnh `assert.*`, không có skip/todo.
- CI ma trận Node 20/22/24 chạy test + proof + soak + package. Có pre-push hook. Hook Stop/PostToolUse chạy thật (tôi đã thử, đều exit 0 khi test xanh).
- Hai chỗ bị trừ:
  - Bằng chứng ghi "chạy lại ở tag phase-4" nhưng tag đó không tồn tại.
  - Không có người hoặc agent khác đánh giá. Chính `docs/notes/phase-1.md:63` tự nhận điều này và các phase sau không sửa.

**C (13/15).**
- Mỗi phase có bảng giả định (A1–A16, A2-01..20, A3-01..12, A4-01..13) và bảng AC → test.
- Phase 3 làm tốt phần thay đổi yêu cầu: có ADR 0001, mục Breaking changes trong CHANGELOG, test cũ đánh dấu `T3:` kèm bảng lý do (`docs/notes/phase-3.md` §4).
- AGENTS.md ngắn, có lệnh và quy ước, được sửa 5 lần qua các phase (`git log --follow AGENTS.md`). Các luật thêm vào xuất phát từ lỗi thật (vá file bằng heredoc, mở ảnh trước khi dùng).
- Skill `verify-game` + 2 hook + pre-push đều có ích và mô tả rõ khi nào dùng.
- Git: commit message rõ ràng. Nhưng mỗi phase được commit dồn trong vài giây (ví dụ 4 commit Phase 4 cùng lúc 18:06:25–18:06:46). Commit evidence rất to (+7303 dòng, chủ yếu là jsonl). Thiếu tag `phase-2/3/4`, thiếu Release. 12 commit chưa push (origin/main = `9a31de2`).

**D (8.5/10).**
- Mỗi `docs/notes/phase-*.md` có mục "Đánh giá Phase N": đạt gì, chưa kiểm chứng gì, cân bằng, rủi ro với test ẩn.
- Bảng "Lỗi của AI" cho cả 4 phase đều có cách phát hiện và cách chỉnh harness. Rất tốt.
- Token chỉ là khoảng ước lượng (150–400k), mỗi phase và retro vẫn còn câu "_Thay bằng số thật từ `/cost`… trước khi nộp_". Đây là placeholder chưa hoàn tất.
- `docs/retro.md` đủ các mục ticket yêu cầu.

**E (≈9/10).**
- Bench (chạy 1 lần): avg 325.5 FPS, p1_low 95.4 FPS, p95 5.4 ms, load 2020 ms, 9766 frame. Vượt ngưỡng xa.
- Soak: 0 crash, 47.3 → 47.9 MB (×1.013). Kết quả từng Đêm (ticks/score) trùng với `docs/proof/phase-4/soak.json`, tức là tất định.
- Rủi ro trên máy chấm:
  - `scripts/bench.js:138` dùng `new WebSocket` toàn cục, chỉ có từ Node 22. README ghi "Node ≥ 18", CI chạy Node 20 nhưng CI không chạy bench.
  - Bench chưa từng chạy trên Linux/macOS.
  - Cần cài Chrome/Edge.
  - `mem_end` đo sau GC ép buộc (`--expose-gc`, GC→300 ms→GC). Cách này hợp lệ và có ghi ở A4-04, nhưng là cách đo "đẹp".

**F (8/10).**
- Theo code (`web/main.js` 1131 dòng, `web/audio.js`) và 30 ảnh, có đủ: 3 Đêm, menu/giới thiệu/kết quả/Bình Minh, pause, cài đặt lưu localStorage, đổi phím có báo trùng, mù màu, chữ lớn, giảm chuyển động, phụ đề + mũi tên, bảng xếp hạng (server ghi `data/leaderboard.json`), HUD đúng bố cục, thanh dầu.
- Tôi đã chạy `node server.js --port 5399`: trang, `web/main.js` và three.js đều trả 200.
- Chưa ai chơi bằng bàn phím. Âm thanh chưa ai nghe.
- Cân bằng: bot thắng Đêm 2 3/7, Đêm 3 2/7.
- Hệ quả của A3-04: khi không có ai đến gần, Bóng Mực đi tới đèn tắt gần nhất rồi đứng yên cách 1 m, nên người chơi đứng yên ở giữa đảo không bao giờ bị đánh (P1-idle-lose thua vì `dawn`).

**G (0/5).** Không có `docs/demo/demo.mp4`, không có Release. Dòng đầu README là "Video demo: [docs/demo/](docs/demo/) (đính kèm Release v1.0.0)", trỏ tới một kịch bản quay.

---

## 2. Bảng probe (hạng mục A)

Lệnh: `node src/headless.js` (đúng `headless_cmd`). Scenario và inputs ở `scratchpad/audit/probes/`, output ở `probes/out/`. Kỳ vọng được tính tay từ spec **trước** khi xem output.

| # | Spec | Kỳ vọng (tự tính) | Thực tế | KQ |
|---|---|---|---|---|
| P02 | v1.1–1.2 snapshot tick 0, Đêm 1 mặc định | time_left 240, 20 đom đóm, 0 shade, đèn ở toạ độ chuẩn, có đủ trường v1.1/v1.2 (`night`, `wind`, `vel`, `capacity`…), end ticks 0 | đúng hết | PASS |
| P03 | v1.0 §C move + cam_yaw + chuẩn hoá | 60 tick: (0,0,6); yaw 90 → (6,0,0); [1,1] → (4.243,0,4.243) | đúng | PASS |
| P04 | nhặt XZ ≤ 1.0, đi +Z | `mote_picked` ở tick 40, điểm 0 | tick 40, điểm 0 | PASS |
| P05 | thắp 10, +5/đom đóm +100, capacity +2, không thắng sớm | deposit + lantern_lit(relight:false) tick 1, điểm 150, fuel@60 = 99.0, capacity 12, state playing | đúng | PASS |
| P06 | thắp lại 5, +40 | deposit 5, relight:true, điểm 65, relit_count 1, carried 2 | đúng | PASS |
| P07 | châm dầu `ceil((100−fuel)/10)` sau khi trừ dầu ở bước 2 | fuel 50 → 49.983 → used **6**, fuel 100, điểm 30 | 6 / 100 / 30 | PASS (test viết vội có thể mong 5; theo spec thì 6 đúng) |
| P08 | hết dầu | fuel 1 → `lantern_out` tick 60, deposited 0, ever_lit true, fuel 0 | đúng | PASS |
| P09 | bình minh thắng 3/5 | won/dawn_survived @60; 3×(50+99)+3×50 = 597 | 597 | PASS |
| P10 | bình minh 2/5 | lost/dawn @60, điểm 0 | đúng | PASS |
| P11 | hết lửa đúng tick bình minh | no_flames thắng ưu tiên (tick 1) | lost/no_flames @1 | PASS |
| P12 | pulse 3D, choáng 120, đẩy 4 m/15 tick | stunned_ids [S1] @1, x=7 ở tick 15, stunned tới tick 120, hết ở tick 121; +5 | đúng. Ở tick 121 state = `chase` (về wander rồi phát hiện lại ngay trong cùng tick) | PASS* |
| P12b | không đủ 3 đom đóm | không có event pulse | đúng | PASS |
| P13 | chạm 4 m/s, rơi floor(4/2) ra vành 1.5–2.5 m, TTL 480, recoil | player_hit @30, flames 2, dropped 2; mote ở r = 1.503 và 2.48, ttl_s 8; shade `recoil` | đúng | PASS |
| P14 | rơi Y < −10, mất hết, chờ 60 tick | player_hit fall @65, lost 3, flames 2; hồi sinh (0,0,0) ở tick 125 | đúng | PASS |
| P15 | pause: tick tăng, sim_tick đứng yên, state paused | paused @11, resumed @21; tick 30 → sim_tick 20, time 239.667 | đúng | PASS |
| P16 | dash 14 m/s × 12 tick, hồi 90 tick từ lúc bắt đầu | dash @1, z = 2.8 @12; bấm ở 60 bị bỏ qua; bấm ở 90 → dash @91 | đúng | PASS |
| P17 | Gió Lạc 7 m/s, cướp ở XZ ≤ 1.2 | steal @16 (⌈1.8/0.1167⌉), amount 3, carried 3, chuyển flee | đúng | PASS |
| P18 | lịch sinh Đêm 1 + tất định | S1, S2 @300, S3 @780; đom đóm 20→21@240→22@480; 2 lần chạy giống từng byte | đúng | PASS |
| P20 | wander → đèn yếu → drain, −5/s + 1/s, fuel_drain mỗi 60 | drain từ tick 1, fuel_drain @61 (14.0), @121, @181, lantern_out @201, shade về wander | đúng | PASS |
| P21 | capacity = min(20, 10+2×lights) | lights 6 → 20, lights 2 → 14 | đúng | PASS |
| P26 | invuln_ticks 100 | hit ở tick 100 | đúng | PASS |
| Q01 | vùng an toàn chặn ở mép 6 m | shade đứng ở z = 31.002 | đúng (biên +0.002) | PASS |
| Q02 | đèn vừa thắp đẩy shade ra mép ≤ 30 tick, không sát thương | ra tới 6.002 ở tick 30 | đúng | PASS |
| Q03 | pulse khi trùng vị trí → +X; pulse lại làm mới | x = 4 @15; pulse lại @181 đẩy tiếp; điểm 10 | đúng | PASS |
| Q04 | nhảy 7 m/s, g = 20 | đỉnh ≈ 1.225 m, đáp sau ≈ 42 tick | đỉnh 1.167 (Euler bán ẩn), đáp tick 42 | PASS (lệch 5% ở đỉnh) |
| Q05 | hai đèn cách đều → id nhỏ hơn | chọn L1 | L1 | PASS |
| Q06 | pulse trúng shade đang drain | +15 | 15 | PASS |
| Q07 | bản đồ Đêm 2/3 | đèn, Bùa, thời lượng 270/300 đúng bảng | đúng; điểm xuất phát Đêm 3 = (0,0,−30) (A2-01) | PASS* |
| Q08 | Bùa Gió | charm_picked {C1, 600}; tốc 7.2 từ tick sau khi nhặt | đúng (37.58 = 34 + 0.1 + 29 × 0.12) | PASS |
| Q09 | rơi khi còn 1 lửa | lost/no_flames @65, không hồi sinh | đúng | PASS |
| Q10 | đúng 30 dầu vẫn còn vùng | chặn tới tick 30 (fuel 30.0), sau đó shade vào và đánh | đúng | PASS |
| Q11 | gió Đêm 3 | báo trước ở tick 1680 (chọn hướng), thổi 1800–2099 | đúng | PASS |
| P22 | shade trong scenario **không có `state`**, cách 15 m (ngoài tầm phát hiện 12 m) | theo nghĩa "hoạt động bình thường": wander, không đuổi | mặc định **`chase`** → đuổi và đánh ở tick 210 | **RỦI RO** |
| ERR | mã thoát | ticks trùng / JSON hỏng / boolean sai / pos sai / id đèn lạ → 2; `--night 4`, thiếu `--ticks` → khác 0 | 2,2,2,2,2 / 1,1; file thiếu → 2 | PASS |
| PERF | 1 Đêm đầy đủ ≤ 30 s | — | Đêm 1/2/3 (21.600 tick): 255/288/251 ms | PASS |

Tổng: 47/47 kiểm tra cụ thể khớp spec. Hai mục PASS* và P22 là chỗ spec không nói rõ.

### Đánh giá các giả định của sinh viên (rủi ro với test ẩn)

| Giả định | Đánh giá | Rủi ro |
|---|---|---|
| `world.js:124`: shade trong scenario mặc định `state: 'chase'` (không có số hiệu A, **không được ghi trong notes**) | v1.0: "ở trạng thái hoạt động bình thường ngay lập tức". Mặc định `wander` (để luật 12 m/18 m tự quyết) sát chữ hơn. Với `chase`, shade đặt ở 12–18 m sẽ đuổi ngay | **Trung bình** |
| A2-05: `spawning` 60 tick, không gây sát thương | Ticket có tên trạng thái nhưng không cho thời lượng. Test kiểu "shade sinh ở tick 300 đuổi/đánh trước tick 360" sẽ lệch | Trung bình–thấp |
| A2-06 / A3-04: wander 2 m/s, đi tới đèn tắt gần nhất rồi đỗ cách 1 m | Ticket chỉ có "Tốc độ 4.0 m/s" cho Bóng Mực. Test tính thời điểm vào `drain` từ xa (> 2 m) sẽ lệch gấp đôi | **Trung bình** |
| Hết choáng → wander rồi phát hiện lại ngay trong cùng tick | Đúng logic. Test so `state == "wander"` ngay sau choáng khi Mây ở trong 12 m sẽ đỏ | Thấp |
| A2-01: Đêm 3 xuất phát (0,0,−30) | Hợp lý vì (0,0,0) nằm trong tháp. Test chạy Đêm 3 mặc định sẽ khác vị trí | Thấp–trung bình |
| A2-14: `night_start` ở tick 0 | Hợp lý | Thấp |
| A2-12: trần 30 tính cả đom đóm rơi | Spec mơ hồ | Thấp |
| A3-05/06/07/09, A3-11 (ε 1e-6) | Bám thứ tự trong tick; đã tự kiểm biên | Thấp |
| A3-10: `per_second_left = 0` | Đúng: Ticket-03 bỏ thưởng thời gian | Không |
| Nhảy Euler bán ẩn (đỉnh 1.167 so với 1.225) | Test có dung sai ≥ 0.1 thì qua | Thấp |

---

## 3. Lỗi và rủi ro cụ thể

| # | Mức | Vị trí / cách tái hiện | Mô tả | Đề xuất sửa |
|---|---|---|---|---|
| 1 | **blocker** | `git tag -l` → chỉ `phase-1` | Thiếu tag `phase-2`, `phase-3`, `phase-4`. RUBRIC §6: phần của phase thiếu tag không được chấm | Gắn tag vào `f2a5765` (P2), `e73efbf` (P3), `4b2da53` (P4) rồi push. Hạn tag là trong giờ lab |
| 2 | **blocker** | `git rev-parse origin/main` = `9a31de2`; `git log origin/main..main` = 12 commit | Toàn bộ Phase 2–4 **chưa lên GitHub** (theo ref cục bộ; tôi không kiểm được remote) | Push `main` + tag. Cần người dùng đồng ý |
| 3 | **blocker** | Không có Release | Thiếu Release `v1.0.0`. `dist/*.zip` đã có nhưng bị git-ignore | Tạo Release `v1.0.0`, đính kèm `dist/dao-den-long-v1.0.0.zip/.tar.gz` + video |
| 4 | **blocker** (G, SUBMISSION) | `README.md:11`, `docs/demo/` | Không có video `.mp4`. Link ở đầu README trỏ tới kịch bản quay | Quay dưới 5 phút theo kịch bản có sẵn, đính kèm Release, sửa link ở đầu README cho trỏ thẳng tới file |
| 5 | **high** | remote `Stormaka/K5-L3A-Day12-HoangBaoNguyen-2A202603384-AI-SDLC` | Tên repo sai quy ước `K5-L3A-DAY12-<HoVaTen>-<MSSV>-AI-SDLC-Dao-Den-Long`: thiếu `-Dao-Den-Long`, viết `Day12` thay vì `DAY12` | Đổi tên trong Settings, cập nhật URL clone trong README |
| 6 | medium | `src/sim/world.js:124` (`s.state \|\| 'chase'`) — probe P22 | Shade trong scenario không có state mặc định là `chase`. Shade ở 12–18 m vẫn đuổi. Mặc định này không được ghi thành giả định | Đổi mặc định thành `'wander'`, hoặc ít nhất ghi A-xx. Chạy lại test |
| 7 | medium | `src/sim/config.js:73-74` (A2-05/A2-06) | `spawning` 60 tick và wander 2 m/s là số tự đặt. Chúng ảnh hưởng thời điểm đánh, drain và cảnh bench | Giữ, nhưng nêu rõ trong README phần Test Contract. Cân nhắc wander = 4 m/s cho đúng "Tốc độ 4.0 m/s" |
| 8 | medium | Chạy `node benchcheck.mjs` (bench world 33 s) | Trong cảnh bench, 200 shade dồn về L4 (103 con) và L5 (97 con) rồi **đứng yên**. Ở cuối cửa sổ đo chỉ 1/200 con còn di chuyển. Ticket: "rải đều… vẫn di chuyển theo luật wander". Cảnh đo không còn đại diện | Trong bench cho shade lang thang qua waypoint (`wanderStep`) thay vì đỗ ở đèn tắt, hoặc nêu rõ hệ quả này trong README/A4-01 |
| 9 | medium | `scripts/bench.js:138` | Dùng `WebSocket` toàn cục, chỉ có từ Node 22. README/`engines` ghi Node ≥ 18. Máy chấm chạy Node 20 sẽ crash | Đặt `engines` ≥ 22 hoặc kiểm tra và báo lỗi rõ ràng; ghi trong README |
| 10 | medium | `docs/notes/phase-*.md` §Nhật ký, `docs/retro.md` §6 | Token còn là placeholder ("Thay bằng số thật… trước khi nộp") | Điền số thật từ `/cost`/usage, hoặc bỏ câu nhắc và giải thích cách ước lượng |
| 11 | medium | `docs/notes/phase-1.md:63` | Chưa có người hoặc agent khác đánh giá (rubric B "Agent tự kiểm chứng") | Thêm một bước review (subagent hoặc người) kèm biên bản trong `docs/proof/` |
| 12 | low | `docs/proof/phase-2/img$1.png` (commit `f2a5765`) | File rác do biến shell `$1` không được mở rộng | Xoá trong một commit riêng, ghi lý do |
| 13 | low | không có `.gitattributes` | Checkout trên Windows đổi `runs/*.jsonl` sang CRLF, sha256 lệch so với bảng evidence | Thêm `*.jsonl -text` hoặc `eol=lf` |
| 14 | low | `docs/proof/phase-4/README.md:3` | Ghi "Chạy lại (ở tag `phase-4`)" trong khi tag chưa có | Sẽ tự đúng sau khi gắn tag |
| 15 | low | Lịch sử git | Commit dồn cục cuối mỗi phase (cách nhau vài giây), commit evidence +6000–7000 dòng | Commit nhỏ hơn trong lúc làm, tách jsonl evidence ra |
| 16 | low | Q04 | Đỉnh nhảy 1.167 m (lý thuyết 1.225 m) do Euler bán ẩn | Dùng `y += vy*dt - ½g dt²` nếu muốn khớp giải tích |
| 17 | low | Cân bằng (`docs/notes/phase-3.md` §7) | Đêm 2–3 rất khó (bot thắng 3/7, 2/7) | Đúng số chuẩn của ticket nên không đổi số; ghi trong README |

---

## 4. Blocker chỉ sinh viên tự gỡ được (cần thao tác trên GitHub)

1. Push 12 commit cục bộ (`git push origin main`). Trước đó cần người dùng đồng ý.
2. Tạo và push tag `phase-2` (→ `f2a5765`), `phase-3` (→ `e73efbf`), `phase-4` (→ `4b2da53`). Tag `phase-1` (→ `b9789f2`) chỉ thấy ở local, cần xác nhận đã có trên remote. Lưu ý mốc giờ: commit Phase 2 lúc 16:04, Phase 3 lúc 16:45, Phase 4 lúc 18:06 (+07). Cần đối chiếu với giờ lab của lớp vì tag sau hạn có thể không được tính.
3. Tạo GitHub Release `v1.0.0` có bản chạy được (zip/tar.gz trong `dist/`) + `demo.mp4`.
4. Quay video dưới 5 phút, kiểm tra mở được khi chưa đăng nhập, sửa link ở đầu README.
5. Đổi tên repo theo quy ước (`…-AI-SDLC-Dao-Den-Long`, `DAY12`), đặt Public, cập nhật URL trong README.
6. Kiểm tra trên GitHub rằng CI xanh ở commit cuối. Tôi không có mạng nên chưa kiểm được.

---

## 5. Tôi đã tự kiểm chứng gì, chưa kiểm chứng được gì

**Đã tự kiểm chứng:**
- Đọc spec gốc: PRD-0/contract v1.0 từ HTML, TICKET-02/03/04 từ transcript.
- Clone sạch → `npm install` (3 s) → `npm test` 73/73 → server trả 200 cho trang, `main.js` và three.js. Cài và chạy đúng 3 lệnh.
- 33 probe headless với kỳ vọng tự tính (mục 2). Tất định. Mỗi Đêm đầy đủ chạy dưới 0.3 s.
- Chạy lại 4 run evidence của Phase 4: sha256 khớp từng byte.
- Code ở tag `phase-1` (contract v1.0, tuning tự chọn) vẫn chạy ví dụ của contract.
- Soak 1 lần (0 crash, ×1.01). Bench 1 lần (325.5 / 95.4 FPS, load 2020 ms).
- Hook Stop/PostToolUse chạy và exit đúng khi test xanh. Đọc CI config.
- Lịch sử AGENTS.md và skill. Không thấy secret trong `git log -p`.
- Xem 4 ảnh bằng chứng (refuel, tầng 2 Đêm 3, đổi phím có báo trùng, cảnh bench).
- Phân tích cảnh bench bằng sim: shade dồn lại và đứng yên.

**Chưa kiểm chứng được:**
- Trạng thái thật trên GitHub (repo public?, tag/Release trên remote?, CI xanh?, tên repo hiện tại). Tôi không dùng mạng.
- Chơi bằng bàn phím, âm thanh, luồng menu qua đủ 3 Đêm, cài đặt còn sau khi tải lại trang, nhập tên có dấu qua UI. API leaderboard từ chối POST thủ công của tôi vì thiếu `achieved_at`, nên tôi chỉ dựa vào test P4-01..03.
- Bench/soak trên máy chấm và trên Linux/macOS. Docker build.
- Test ẩn thật của giảng viên. Phần A chỉ là ước tính từ probe.
