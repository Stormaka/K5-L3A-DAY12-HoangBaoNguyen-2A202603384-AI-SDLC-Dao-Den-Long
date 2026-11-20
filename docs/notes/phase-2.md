# Phase 2 — Ticket-02 "Ba hòn đảo" + Test Contract v1.1

## 1. Ticket yêu cầu gì (tóm tắt)

1. **Số liệu chuẩn** thay mọi số tự chọn ở Phase 1 (Phần 1 của ticket), kèm **thứ tự xử lý trong một tick** bắt buộc.
2. **Bản đồ chuẩn** cho 3 Đêm: Đảo Bến (chuẩn hóa lại), Đảo Cau (2 đảo, cầu tre, bục nhảy), Đảo Chuông (3 tầng, dốc, bục nhảy, tháp chuông, gió).
3. **Tính năng mới:** Gió Lạc, Bùa Gió, chuỗi 3 Đêm (menu → giới thiệu → chơi → kết quả → Bình Minh), tạm dừng, cài đặt lưu được, âm thanh, HUD đầy đủ, bảng màu chuẩn, ánh sáng môi trường theo tiến độ.
4. **Test Contract v1.1:** tuning mới, `--night 1|2|3`, các trường snapshot mới, scenario mới, input `dash`/`pause`, các sự kiện mới, tên trạng thái Bóng Mực cố định, một Đêm headless ≤ 30 s.

Số liệu nằm duy nhất trong `src/sim/config.js` (TUNING = khóa contract, WORLD = số chuẩn còn lại). Bản đồ nằm trong `src/sim/maps.js`.

## 2. Giả định cho chỗ ticket chưa nói rõ

| # | Chỗ mơ hồ | Giả định | Lý do |
|---|---|---|---|
| A2-01 | Điểm xuất phát Đêm 3 | **(0, 0, −30)**, quay mặt về +Z. Đêm 2 xuất phát ở (0,0,0) | (0,0,0) của Đêm 3 nằm trong tháp chuông (trụ r = 2 m trên tầng 2), không đứng được |
| A2-02 | Tăng tốc/dừng "≤ 0.1 s" | Vận tốc đổi **ngay trong 1 tick** (0 s) | Thỏa "≤ 0.1 s" và giữ test di chuyển Phase 1 chính xác (6 m sau 60 tick) |
| A2-03 | Leo dốc, vách đứng | Mỗi tick chỉ được bước lên cao hơn tối đa **0.35 m**; cao hơn thì là tường (trượt theo một trục nếu được). Đi xuống thì rơi tự do | Dốc 3 m / 6 m: mỗi tick lên ≤ 0.23 m kể cả khi lướt, nên đi được dốc nhưng không leo được vách |
| A2-04 | Tỏa Sáng | Event `pulse.stunned_ids` chỉ liệt kê Bóng Mực. Gió Lạc trúng Tỏa Sáng không cộng điểm | Contract định nghĩa `stunned_ids`; ticket chỉ cho +5 với Bóng Mực |
| A2-05 | Trạng thái `spawning` | Kéo dài **60 tick**: đứng yên, không gây sát thương, vẫn có thể bị Tỏa Sáng | Ticket bắt buộc tên trạng thái nhưng không cho thời lượng |
| A2-06 | Trạng thái `wander` | Đi **2 m/s** tới một điểm sinh đom đóm ngẫu nhiên (rng), đổi điểm khi tới nơi hoặc bị chặn | Ticket chỉ cho 12 m phát hiện / 18 m bỏ đuổi |
| A2-07 | Hết `stunned`/`recoil`/`spawning` | Về `chase` nếu Mây trong 12 m, ngược lại về `wander` | Dùng đúng quy tắc phát hiện |
| A2-08 | Bóng Mực và địa hình | Bay lơ lửng: tâm cao hơn mặt đất 1 m, **bám theo độ cao địa hình** (qua được vách tầng), không ra khỏi mặt đất (biển mây, khe giữa 2 đảo), không vào tháp chuông | Ticket không nói Bóng Mực leo tầng được không; chọn cách đơn giản để Bóng Mực vẫn là mối đe dọa trên mọi tầng |
| A2-09 | "Điểm sương" của Gió Lạc | Dùng các **điểm sinh Bóng Mực** của Đêm đó | Ticket không định nghĩa điểm sương |
| A2-10 | Gió Lạc: chạm | Áp dụng cho trạng thái `idle` và `chase`, chỉ khi Mây đang mang > 0. Gió Lạc bay tự do (không bị địa hình, vùng an toàn chặn), tâm cao 1.5 m trên mặt đất | Ticket: "vùng an toàn không chặn Gió Lạc" |
| A2-11 | Gió Lạc bị Tỏa Sáng khi đang chạy trốn | Thả đom đóm ngay tại vị trí XZ của nó (dạng `dropped`, TTL 480), rồi biến mất sau 120 tick | "thả lại toàn bộ ... tại chỗ" |
| A2-12 | Đếm trần 30 đom đóm | Đếm **mọi** đom đóm (ngẫu nhiên + rơi). "Điểm trống" = điểm sinh không có đom đóm nào trong 1 cm | |
| A2-13 | Đom đóm rơi khi bị đánh | Góc + bán kính ngẫu nhiên trong vành 1.5–2.5 m. Nếu chỗ đó là biển/tầng khác thì thử xoay 45° (8 lần), sau cùng đặt tại chân Mây | Tránh đom đóm rơi xuống biển mây |
| A2-14 | `night_start` | Ghi ở **tick 0**, ngay sau snapshot đầu tiên, `{night}` | Đêm bắt đầu trước bước đầu tiên. Dựng scenario vẫn không sinh sự kiện gameplay nào |
| A2-15 | `player_hit` do rơi | `{by:"fall", flames, dropped:0, lost:n}`. Trong 60 tick chờ hồi sinh: không di chuyển, không nhặt, không bị chạm; Bóng Mực/Gió Lạc coi như mất mục tiêu | "mất toàn bộ đom đóm" là mất (lost), không rơi ra đất |
| A2-16 | Snapshot `player.invuln`, `vel` | `invuln` là boolean. `vel` = độ dời thực tế / 1 tick (m/s) | Các trường khác đã có hậu tố `_s` |
| A2-17 | Gió: hướng | Chọn bằng rng (độ, số nguyên 0–359) ở lúc báo trước (2 s trước cơn gió). Gió đẩy cả lúc bay và lúc lướt. `dir_deg` giữ hướng gần nhất khi gió tắt (0 nếu chưa có) | |
| A2-18 | Tạm dừng trong headless | Nút `pause` bật/tắt. Trong khi tạm dừng, mọi input khác bị bỏ qua nhưng vẫn ghi nhận trạng thái nút, nên nhấn trong lúc dừng **không** kích hoạt sau khi tiếp tục. Bước bấm "tiếp tục" chạy gameplay luôn | Ticket: "nếu vừa tạm dừng thì dừng bước ở đây" (chỉ áp dụng khi vừa dừng) |
| A2-19 | Bùa Gió hồi lại | Đếm ngược 2700 tick trong pha "giảm bộ đếm"; tick nó hiện lại thì nhặt được ngay | Ticket liệt kê "hồi bùa" trong pha bộ đếm |
| A2-20 | Tạm dừng trên web | Esc/P dừng hẳn vòng lặp sim (không gọi `step`); mất focus cửa sổ cũng tự tạm dừng | "logic dừng hoàn toàn" |

## 3. Tiêu chí nghiệm thu (AC) → test

Mỗi tiêu chí có ít nhất một test tự động (`tests/phase2.test.js`, `tests/contract.test.js`) **và** một kịch bản headless qua CLI thật (`scripts/proof.js`, file trong `tests/scenarios/`). Riêng phần chỉ có trên giao diện (âm thanh, HUD, menu, cài đặt) được kiểm bằng ảnh chụp và cần người chơi thử.

### Phần 1 — số liệu chuẩn

| AC | Tiêu chí | Test | Kịch bản headless |
|---|---|---|---|
| Lướt | 14 m/s × 12 tick theo hướng di chuyển (đứng yên thì theo hướng mặt), hồi 1.5 s từ lúc lướt, giữ độ cao khi lướt trên không | P2-04, P2-05 | P2-dash |
| Nhảy | 7 m/s, g = 20 → đỉnh ~1.2 m, chỉ nhảy khi chạm đất | P2-03, AC-05 | — |
| Nhặt | XZ ≤ 1.0 m và chênh cao ≤ 1.5 m | AC-06, P2-06 | P1-lantern |
| Đom đóm | 20 lúc đầu trên 20 điểm khác nhau; +1 mỗi 240 tick; hết điểm trống thì bỏ lượt | P2-01, P2-02 | P1-win-n1 |
| Đèn | Chi phí 10, nạp nhiều lần, r = 2.0 m, gần nhất, bằng nhau thì id nhỏ | AC-08, AC-09, P2-07 | P1-lantern |
| Vùng an toàn | 6 m, đẩy Bóng Mực đang ở trong ra mép trong ≤ 30 tick, không gây sát thương | AC-16, P2-08 | P2-safezone |
| Tỏa Sáng | 3 đom đóm, 5 m (3D từ chân + 0.8 m), choáng 120 tick, đẩy 4 m trong 15 tick, dừng ở vật cản, trùng vị trí thì +X, làm mới, +5 mỗi con | AC-14, AC-15, P2-09, P2-10 | P2-pulse |
| Bóng Mực | 4 m/s (Đêm 3: 4.5), phát hiện 12 m / bỏ 18 m, lịch sinh 2 con @300 rồi mỗi 8/7/6 s, tối đa 6/8/10, cách Mây ≥ 15 m | AC-12, AC-18, P2-11 | P1-idle-lose, P2-idle-n2 |
| Bị đánh | −1 lửa, rơi floor(mang/2) ra vành 1.5–2.5 m (TTL 480), bất tử 90 tick, bóng lùi 2 m/60 tick, bóng khác chạm lúc bất tử không làm gì | AC-13, P2-12, P2-13 | P1-idle-lose |
| Rơi | Y < −10: −1 lửa, mất hết đom đóm, bỏ qua bất tử, chờ 60 tick rồi hồi sinh (bất tử 90); hết lửa thì thua ngay | AC-04, P2-14 | P2-fall |
| Thắng/thua | Hết lửa luôn thua; thắp hết đèn thì thắng kể cả đúng tick hết giờ; còn lại hết giờ thì `dawn` | AC-11, AC-17, P2-15 | P1-dawn |
| Điểm | +10 mỗi đom đóm **nạp**, +100/đèn, +5 mỗi Bóng Mực trúng Tỏa Sáng, thưởng khi thắng | AC-06, AC-08, AC-11, AC-14 | P1-lantern |

### Phần 2 — bản đồ

| AC | Test | Kịch bản headless |
|---|---|---|
| Vị trí đèn, thời lượng, điểm sinh của 3 Đêm đúng bảng | AC-01, P2-01 | — |
| Đêm 2: bục nhảy bắn sang đảo kia, phím di chuyển không lái được | P2-17 | P2-pad-n2, P2-win-n2 |
| Đêm 3: vách tầng chặn, dốc lên tầng 1, bục lên tầng 2, tháp không vào được | P2-18 | P2-terrain-n3, P2-win-n3 |
| Đêm 3: gió 5 s mỗi 30 s, 2 m/s, báo trước 2 s | P2-19 | P2-wind-n3 |

### Phần 3 — tính năng mới

| Tính năng | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| **Gió Lạc** | idle → chase khi mang ≥ 5 và cách ≤ 15 m; chạm (XZ ≤ 1.2) cướp min(3, mang) kể cả khi bất tử; flee 240 tick rồi `removed`; Tỏa Sáng lúc chase → flee không cướp; lúc flee có đồ → thả lại (`drifter_drop`) và biến mất sau 120 tick; không mất lửa; sinh @1200, 2400… tối đa 2, id D1, D2; chỉ Đêm 2–3 | P2-20, P2-21, P2-22; headless P2-drifter-steal, P2-drifter-pulse, P2-idle-n2 |
| **Bùa Gió** | Nhặt như đom đóm → `charm_picked {charm_id, charm_ticks:600}`; 600 tick chạy 7.2 m/s, lướt không hồi chiêu (nhấn khi đang lướt bị bỏ qua); hồi lại sau 2700 tick; vị trí theo Đêm | P2-23, P2-24; headless P2-charm |
| **Chuỗi 3 Đêm** | Menu → giới thiệu (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp; thắng Đêm 3 → Bình Minh với tổng điểm; thua → chơi lại Đêm đó; tổng điểm = tổng các Đêm đã thắng | Headless P1-win-n1, P2-win-n2, P2-win-n3 (mỗi Đêm thắng được); ảnh menu/intro/result/dawn. **Luồng bấm nút chưa được người chơi thử** |
| **Tạm dừng** | Esc/P dừng logic hoàn toàn; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; headless: tick tăng, sim_tick/thời gian/hồi chiêu/spawn đứng yên, `state:"paused"`, sự kiện `paused`/`resumed` | P2-16; headless P2-pause; ảnh pause |
| **Cài đặt** | Âm lượng + độ nhạy chuột, lưu giữa các lần mở game (localStorage) | Ảnh settings. **Chưa kiểm chứng tự động** việc lưu qua lần mở sau |
| **Âm thanh** | Nhạc nền đêm + hiệu ứng: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối | Tổng hợp bằng WebAudio (`web/audio.js`), gắn theo sự kiện sim. **Chưa kiểm chứng bằng tai**: cần người chơi thử |
| **HUD** | Lửa (trên trái), mm:ss (trên giữa, đỏ nhấp nháy ≤ 30 s), đèn k/n + điểm (trên phải), 10 ô đom đóm (dưới giữa), hồi chiêu Lướt/Tỏa Sáng (dưới phải), nhắc "E — Nạp ánh sáng (x/10)", mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | Ảnh n1-play, n1-prompt, n2-play, n3-play |
| **Bảng màu + ánh sáng** | Màu chuẩn cho các thành phần liệt kê; ambient = 0.15 + 0.55 × đèn sáng / tổng | Hằng `C` trong `web/main.js` dùng đúng mã hex; công thức trong `sync()`; ảnh |
| **≥ 30 FPS @1280×720** | FPS trung bình đo thật | `npm run fps` (Chrome + DevTools Protocol): xem bằng chứng |

## 4. Test Phase 1 bị đổi vì Ticket-02 (ghi "T2:" trong `tests/gameplay.test.js`)

| Test | Thay đổi | Vì sao |
|---|---|---|
| AC-01 | 20 đom đóm (cũ 30), không có Bóng Mực lúc đầu, vị trí đèn theo bảng, player có thêm trường v1.1 | Số liệu và bản đồ chuẩn |
| AC-04 | Từ "mép đảo là tường" thành "rơi khỏi đảo" (tick 460, hồi sinh tick 520) | `fall_enabled` giờ là true |
| AC-06 | Nhặt ở tick 40 (r = 1.0), **không cộng điểm khi nhặt** | Điểm tính khi nạp |
| AC-08, AC-11 | Chi phí đèn 10, điểm tính theo đom đóm nạp | Số chuẩn |
| AC-13 | Bị đánh lần đầu ở tick 15 (4 m/s); các lần sau chỉ kiểm khoảng cách ≥ 90 tick | Bóng Mực giờ lùi 2 m sau khi đánh (recoil), nên khoảng cách giữa các lần thay đổi |
| AC-14, AC-15 | Tốn 3, r = 5 (3D), đẩy 4 m trong 15 tick, hồi 3 s | Số chuẩn |
| AC-18 | 2 con ở tick 300 rồi mỗi 480 tick, tối đa 6 | Lịch sinh chuẩn |
| AC-19 | `deposited: 9` < 10 nên L2 chưa sáng; bỏ qua `night_start` khi đếm sự kiện | Chi phí mới; A2-14 |
| C-01 | `contract_version` 1.1 + khóa tuning mới, so với số chuẩn | Contract v1.1 |

Không test nào bị nới lỏng để cho qua. Những test trên đổi vì luật đổi, và số mong đợi được tính tay lại trước khi chạy.

## 5. Kế hoạch kiểm chứng (lập trước khi viết code)

1. Viết số chuẩn và bản đồ vào `config.js` / `maps.js`. Test C-01 so `game.contract.json` với số chuẩn trong ticket (không so với code).
2. Test hành vi trên sim (`tests/phase2.test.js`) với số tick tính tay trước. Ví dụ: Gió Lạc cướp ở tick 76 = ⌈8.8 / (7/60)⌉, rơi khỏi đảo ở tick 460, đẩy tới mép đảo dừng ở x = 39.8.
3. Test contract qua **CLI thật**: các trường v1.1, mã thoát cho file sai định dạng mới, `--night 4` lỗi, L7 chỉ có ở Đêm 3, một Đêm 21.600 tick ≤ 30 s.
4. `npm run proof`: 19 kịch bản qua CLI, mỗi kịch bản chạy 2 lần so từng byte. Mỗi kịch bản có hàm kiểm riêng, không chỉ dòng `end`.
5. Bot tự chơi (`scripts/bot.js`, tìm đường Dijkstra trên lưới 1 m) chơi trên sim thật để chứng minh **mỗi Đêm thắng được**; inputs được ghi lại và chạy lại qua headless.
6. Chrome headless: ảnh cho từng màn hình. FPS đo bằng `scripts/fps.js` (DevTools Protocol, 10 s, camera di chuyển, cảnh nặng nhất).

## 6. Nhật ký dùng AI

- Công cụ: Claude Code (VS Code), model Claude Opus 5.5, một phiên.
- Quy trình:
  1. Người dùng dán Ticket-02 (agent không đọc được tab phase mới trên lab board).
  2. Agent đọc lại contract v1.0 đã lưu, tóm tắt ticket và chốt giả định.
  3. Viết config, bản đồ, sim mới.
  4. Viết test Phase 1 (số chuẩn) và test Phase 2, chạy, sửa.
  5. Contract v1.1, rồi bot, rồi proof.
  6. Viết client web, rồi ảnh và FPS, rồi tài liệu.
- Lời nhắc chính: "đây [Ticket-02] và làm cho tôi".
- **Token/chi phí ước tính:** khoảng 250–350k token input (đọc lại ngữ cảnh) và 60–80k token output. _Thay bằng số thật từ `/cost` hoặc trang usage trước khi nộp._
- Cách tiết kiệm token:
  - Viết lại cả file một lần thay vì sửa vụn.
  - Chạy test chỉ lấy dòng tổng kết hoặc dòng lỗi.
  - Dùng bot và proof để kiểm tra thay vì đọc log dài.
  - Không dùng subagent.

### Lỗi của AI và cách phát hiện

| Lỗi | Phát hiện bằng | Sửa / phòng ngừa |
|---|---|---|
| Tính sai đỉnh bay của bục nhảy (cho rằng > 5 m; thực tế v²/2g = 4.9 m) | Test P2-17 đỏ | Sửa **kỳ vọng** (lỗi ở phép tính trong test, không ở code), ghi công thức vào comment |
| Lại hỏng ký tự `\n` khi vá file qua heredoc Python (SyntaxError trong contract test), giống lỗi Phase 1 | `npm test` đỏ ngay | Dùng công cụ Edit cho chuỗi có ký tự đặc biệt; không vá file qua heredoc |
| Bot đầu tiên thua cả 9 ván: đi thẳng qua Bóng Mực | Chạy bot 3 Đêm × 3 seed | Thêm né vùng nguy hiểm, Lướt thoát, ưu tiên Lướt hơn Tỏa Sáng (Tỏa Sáng tốn 3 đom đóm) |
| Ảnh "tầng 2" lần đầu sai: đặt sẵn 7 đèn sáng nên game thắng ngay ở tick 1, camera lọt vào trong tháp | Mở ảnh ra xem | Chụp lại với 6 đèn và góc khác; **luôn mở ảnh ra xem** trước khi dùng làm bằng chứng |
| Màn Bình Minh vẫn tối: `sync()` ghi đè màu nền mỗi khung hình | Mở ảnh ra xem | Đặt màu bình minh trong `sync()` khi `mode === 'dawn'` |
| Bùa Gió hồi lại sớm 1 tick: lần đầu trừ bộ đếm ở pha spawn ngay trong tick vừa nhặt | Đối chiếu thứ tự xử lý trong ticket khi viết P2-23 | Chuyển việc trừ bộ đếm vào pha "giảm bộ đếm" (A2-19) |

## 7. Đánh giá Phase 2

- **Đạt, có bằng chứng tự động:**
  - Toàn bộ Phần 1 (số chuẩn, thứ tự tick), Phần 2 (3 bản đồ) và Phần 4 (contract v1.1).
  - Logic của Gió Lạc, Bùa Gió và tạm dừng.
  - `npm test` 53/53 đạt; `npm run proof` 19/19 PASS, tất định.
  - Bot thắng được cả 3 Đêm.
  - Một Đêm headless chạy khoảng 0.1–0.5 s, xa dưới mốc 30 s.
- **FPS:** trung bình 130–149 FPS ở 1280×720 trên máy dev (RTX 5050 Laptop), khung chậm nhất 36–46 FPS. Trên SwiftShader (không có GPU) chỉ khoảng 5 FPS; đó là giới hạn của dựng hình bằng CPU.
- **Chưa kiểm chứng đủ (cần người chơi thử, ghi kết quả vào bảng bằng chứng):**
  - Nghe âm thanh.
  - Cảm giác điều khiển.
  - Luồng bấm nút menu qua đủ 3 Đêm.
  - Cài đặt được giữ lại sau khi tải lại trang.
- **Cân bằng game:**
  - Đêm 3 rất sát giờ: bot thắng 3/5 seed, thường chỉ còn 10–60 s.
  - Người chơi lần đầu có thể thấy Đêm 3 khó. Số liệu là chuẩn của ticket nên không chỉnh; ghi lại để bàn ở phase sau.
  - Đêm 1–2 bot thắng 3/3 seed.
- **Rủi ro với test ẩn:** các giả định A2-05 (spawning 60 tick), A2-08 (Bóng Mực qua được vách tầng) và A2-14 (`night_start` ở tick 0) có thể khác cách hiểu của giảng viên. Đã ghi rõ ở trên.
